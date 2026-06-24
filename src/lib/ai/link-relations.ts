import Anthropic from "@anthropic-ai/sdk";
import { getFacts, setFactRelations } from "@/lib/firestore";
import { adjacentEras } from "@/lib/domain";
import type { FactDTO } from "@/lib/types";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 미설정");
    _client = new Anthropic();
  }
  return _client;
}

const MAX_CANDIDATES = 60;
const MAX_LINKS = 5;

/** fact era의 인접 시대 facts (자기 자신 제외, year 오름차순, 상한). */
export function candidateFactsForFact(fact: FactDTO, allFacts: FactDTO[]): FactDTO[] {
  const eras = new Set(adjacentEras(fact.era));
  return allFacts
    .filter((f) => eras.has(f.era) && f.id !== fact.id)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    .slice(0, MAX_CANDIDATES);
}

function cleanList(returned: unknown, allow: Set<string>, selfId: string, max: number): string[] {
  if (!Array.isArray(returned)) return [];
  const out: string[] = [];
  for (const v of returned) {
    if (typeof v === "string" && v !== selfId && allow.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** AI 반환값을 정제: 후보 화이트리스트·self 제외·prev/next 중복금지·각 최대 max. */
export function sanitizeRelations(
  returned: unknown,
  candidateIds: string[],
  selfId: string,
  max: number = MAX_LINKS
): { prevFactIds: string[]; nextFactIds: string[] } {
  const allow = new Set(candidateIds);
  const r = (returned ?? {}) as { prevFactIds?: unknown; nextFactIds?: unknown };
  const prev = cleanList(r.prevFactIds, allow, selfId, max);
  const prevSet = new Set(prev);
  const next = cleanList(r.nextFactIds, allow, selfId, max).filter((id) => !prevSet.has(id));
  return { prevFactIds: prev, nextFactIds: next };
}

const REL_TOOL = {
  name: "select_relations",
  description: "한 사건의 이전(배경·원인)·이후(결과·영향) 연표 항목 id를 선택한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      prevFactIds: { type: "array", items: { type: "string" }, description: "이 사건의 직접적 배경·원인이 된 연표 id. 없으면 빈 배열. 최대 5개." },
      nextFactIds: { type: "array", items: { type: "string" }, description: "이 사건의 직접적 결과·영향이 된 연표 id. 없으면 빈 배열. 최대 5개." },
    },
    required: ["prevFactIds", "nextFactIds"],
  },
};

const REL_SYSTEM = `당신은 한국사 사건의 인과·흐름 관계를 연결하는 전문가입니다.
주어진 '대상 사건'에 대해 후보 연표 중에서:
- prevFactIds: 대상 사건의 직접적 배경·원인이 된 사건만 고릅니다(대개 더 이른 시기).
- nextFactIds: 대상 사건의 직접적 결과·영향이 된 사건만 고릅니다(대개 더 늦은 시기).
- 연도는 강한 힌트이되, 역사적 인과가 우선입니다.
- 단지 같은 시대라는 이유로 무관한 항목을 넣지 않습니다(억지 연결 금지). 없으면 빈 배열.
- 반드시 select_relations 도구를 호출합니다.`;

/** 단일 사건의 이전/이후 관계를 Claude로 산출. 실패·후보없음 시 빈 결과. */
export async function linkFactRelations(
  fact: FactDTO,
  allFacts: FactDTO[]
): Promise<{ prevFactIds: string[]; nextFactIds: string[] }> {
  const cands = candidateFactsForFact(fact, allFacts);
  if (cands.length === 0) return { prevFactIds: [], nextFactIds: [] };
  const candidateList = cands
    .map((f) => `- id:${f.id} | ${f.year ?? "?"} | ${f.title} | ${f.keywords.join(",")}`)
    .join("\n");
  const userText =
    `[대상 사건]\nid:${fact.id} | ${fact.year ?? "?"} | ${fact.title}\n내용: ${fact.body}\n핵심어: ${fact.keywords.join(", ")}\n시대: ${fact.era}\n` +
    `\n[연표 후보]\n${candidateList}\n\n대상 사건의 이전(배경·원인)·이후(결과·영향) 연표 id를 select_relations로 반환하세요.`;
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 400,
      system: REL_SYSTEM,
      tools: [REL_TOOL],
      tool_choice: { type: "tool", name: "select_relations" },
      messages: [{ role: "user", content: userText }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    const input = block && block.type === "tool_use" ? block.input : {};
    return sanitizeRelations(input, cands.map((f) => f.id), fact.id);
  } catch {
    return { prevFactIds: [], nextFactIds: [] };
  }
}

/** 일괄: missing=prev·next 모두 빈 항목만, all=전체. 순차. */
export async function linkAllRelations(
  mode: "missing" | "all"
): Promise<{ processed: number; linked: number }> {
  const allFacts = await getFacts();
  const targets = allFacts.filter(
    (f) => mode === "all" || (f.prevFactIds.length === 0 && f.nextFactIds.length === 0)
  );
  let linked = 0;
  for (const f of targets) {
    const rel = await linkFactRelations(f, allFacts);
    await setFactRelations(f.id, rel.prevFactIds, rel.nextFactIds);
    if (rel.prevFactIds.length > 0 || rel.nextFactIds.length > 0) linked++;
  }
  return { processed: targets.length, linked };
}
