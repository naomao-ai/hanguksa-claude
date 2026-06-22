import Anthropic from "@anthropic-ai/sdk";
import { getAllQuestions, getFacts, setQuestionFactIds } from "@/lib/firestore";
import { adjacentEras } from "@/lib/domain";
import type { FactDTO, QuestionDTO } from "@/lib/types";

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

/** 문제 era의 인접 시대 facts만 추려 후보로 반환 (year 오름차순, 상한 적용). */
export function candidateFacts(question: QuestionDTO, allFacts: FactDTO[]): FactDTO[] {
  const eras = new Set(adjacentEras(question.era));
  return allFacts
    .filter((f) => eras.has(f.era))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    .slice(0, MAX_CANDIDATES);
}

/** AI 반환값을 후보 화이트리스트로 정제: 교집합·중복제거·상한. */
export function sanitizeFactIds(
  returned: unknown,
  candidateIds: string[],
  max: number = MAX_LINKS
): string[] {
  if (!Array.isArray(returned)) return [];
  const allow = new Set(candidateIds);
  const out: string[] = [];
  for (const v of returned) {
    if (typeof v === "string" && allow.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

const LINK_TOOL = {
  name: "select_facts",
  description: "문제와 직접 관련된 연표 항목 id들을 선택한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      factIds: {
        type: "array",
        items: { type: "string" },
        description: "관련 연표의 id 배열. 직접 관련된 것만. 없으면 빈 배열. 최대 5개.",
      },
    },
    required: ["factIds"],
  },
};

const LINK_SYSTEM = `당신은 한국사능력검정시험 문제와 한국사 연표를 연결하는 전문가입니다.
주어진 문제가 다루는 사건·인물·제도와 직접 관련된 연표 항목만 고릅니다.
- 같은 주제를 다루거나 문제 풀이에 직접 도움이 되는 항목만 선택합니다.
- 단지 같은 시대라는 이유로 무관한 항목을 넣지 않습니다(억지 연결 금지).
- 관련 항목이 없으면 빈 배열을 반환합니다. 반드시 select_facts 도구를 호출합니다.`;

/** 단일 문제에 대해 Claude로 관련 factIds 산출. 실패·후보없음 시 빈 배열. */
export async function linkQuestionToFacts(
  question: QuestionDTO,
  allFacts: FactDTO[]
): Promise<string[]> {
  const cands = candidateFacts(question, allFacts);
  if (cands.length === 0) return [];
  const candidateList = cands
    .map((f) => `- id:${f.id} | ${f.year ?? "?"} | ${f.title} | ${f.keywords.join(",")}`)
    .join("\n");
  const userText =
    `[문제]\n발문: ${question.stem}\n` +
    (question.passage ? `자료: ${question.passage}\n` : "") +
    (question.imageDescription ? `시각자료: ${question.imageDescription}\n` : "") +
    `주제태그: ${question.topics.join(", ")}\n시대: ${question.era}\n` +
    (question.explanation ? `해설: ${question.explanation}\n` : "") +
    `\n[연표 후보]\n${candidateList}\n\n관련 연표 id를 select_facts로 반환하세요.`;

  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 300,
      system: LINK_SYSTEM,
      tools: [LINK_TOOL],
      tool_choice: { type: "tool", name: "select_facts" },
      messages: [{ role: "user", content: userText }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    const input = block && block.type === "tool_use" ? (block.input as { factIds?: unknown }) : {};
    return sanitizeFactIds(input.factIds, cands.map((f) => f.id));
  } catch {
    return [];
  }
}

/** 단건 연결(백그라운드용): id로 문제·연표를 로드해 factIds 갱신. */
export async function linkOneById(questionId: string): Promise<void> {
  const [allFacts, allQ] = await Promise.all([getFacts(), getAllQuestions()]);
  const q = allQ.find((x) => x.id === questionId);
  if (!q) return;
  const factIds = await linkQuestionToFacts(q, allFacts);
  if (factIds.length > 0) await setQuestionFactIds(q.id, factIds);
}

/** 일괄 연결: missing=미연결만, all=전체. 순차 처리. */
export async function linkAllQuestions(
  mode: "missing" | "all"
): Promise<{ processed: number; linked: number }> {
  const allFacts = await getFacts();
  const targets = (await getAllQuestions()).filter(
    (q) => mode === "all" || q.factIds.length === 0
  );
  let linked = 0;
  for (const q of targets) {
    const factIds = await linkQuestionToFacts(q, allFacts);
    await setQuestionFactIds(q.id, factIds);
    if (factIds.length > 0) linked++;
  }
  return { processed: targets.length, linked };
}
