/**
 * 인과관계 백필 — 연표(facts) 간 prev/next 관계를 Ollama로 생성해 Firestore에 기록.
 * 로직은 src/lib/ai/link-relations.ts와 동일(해당 파일은 @/ 별칭을 써 node 직접 실행 불가하므로
 * 여기서는 상대경로 + 인라인으로 재구성). prev·next가 모두 빈 fact만 대상.
 * 개념 노드(era=unknown 등 인접 시대 없음)는 후보가 없어 자동 스킵.
 *
 * 실행:
 *   LIMIT=5 DRY=1 npm run backfill:relations  → 5건 시험(미기록)
 *   node --env-file=.env.local --experimental-strip-types scripts/backfill-relations.ts
 */
import { getFacts, setFactRelations } from "../src/lib/firestore.ts";
import { adjacentEras } from "../src/lib/domain.ts";
import type { FactDTO } from "../src/lib/types.ts";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "hf.co/lmstudio-community/gemma-4-E4B-it-GGUF:latest";
const MAX_CANDIDATES = 60;
const MAX_LINKS = 5;

function candidateFactsForFact(fact: FactDTO, allFacts: FactDTO[]): FactDTO[] {
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

function sanitizeRelations(returned: unknown, candidateIds: string[], selfId: string, max = MAX_LINKS) {
  const allow = new Set(candidateIds);
  const r = (returned ?? {}) as { prevFactIds?: unknown; nextFactIds?: unknown };
  const prev = cleanList(r.prevFactIds, allow, selfId, max);
  const prevSet = new Set(prev);
  const next = cleanList(r.nextFactIds, allow, selfId, max).filter((id) => !prevSet.has(id));
  return { prevFactIds: prev, nextFactIds: next };
}

const REL_SYSTEM = `당신은 한국사 사건의 인과·흐름 관계를 연결하는 전문가입니다.
주어진 '대상 사건'에 대해 후보 연표 중에서:
- prevFactIds: 대상 사건의 직접적 배경·원인이 된 사건만 고릅니다(대개 더 이른 시기).
- nextFactIds: 대상 사건의 직접적 결과·영향이 된 사건만 고릅니다(대개 더 늦은 시기).
- 연도는 강한 힌트이되, 역사적 인과가 우선입니다.
- 단지 같은 시대라는 이유로 무관한 항목을 넣지 않습니다(억지 연결 금지). 없으면 빈 배열.
- 반드시 다음과 같은 JSON 형식으로만 응답해야 합니다:
{
  "prevFactIds": ["id1", "id2"],
  "nextFactIds": ["id3"]
}`;

async function linkFactRelations(fact: FactDTO, allFacts: FactDTO[]) {
  const cands = candidateFactsForFact(fact, allFacts);
  if (cands.length === 0) return { prevFactIds: [], nextFactIds: [] };
  const candidateList = cands
    .map((f) => `- id:${f.id} | ${f.year ?? "?"} | ${f.title} | ${f.keywords.join(",")}`)
    .join("\n");
  const userText =
    `[대상 사건]\nid:${fact.id} | ${fact.year ?? "?"} | ${fact.title}\n내용: ${fact.body}\n핵심어: ${fact.keywords.join(", ")}\n시대: ${fact.era}\n` +
    `\n[연표 후보]\n${candidateList}\n\n대상 사건의 이전(배경·원인)·이후(결과·영향) 연표 id를 반환하세요.`;
  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        system: REL_SYSTEM,
        prompt: userText,
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
      }),
    });
    if (!response.ok) throw new Error("Ollama fetch failed: " + response.status);
    const data = await response.json();
    const resultJson = JSON.parse(data.response.trim());
    return sanitizeRelations(resultJson, cands.map((f) => f.id), fact.id);
  } catch (err: any) {
    console.error("  linkFactRelations Error:", err.message);
    return { prevFactIds: [], nextFactIds: [] };
  }
}

async function main() {
  const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : Infinity;
  const DRY = process.env.DRY === "1";

  const allFacts = await getFacts();
  const targets = allFacts.filter(
    (f) =>
      f.prevFactIds.length === 0 &&
      f.nextFactIds.length === 0 &&
      candidateFactsForFact(f, allFacts).length > 0
  );
  const slice = targets.slice(0, LIMIT === Infinity ? targets.length : LIMIT);
  console.log(
    `총 facts ${allFacts.length} / 관계 없는 대상 ${targets.length} / 이번 실행 ${slice.length}건${DRY ? " (DRY RUN)" : ""}`
  );

  const titleOf = (id: string) => allFacts.find((x) => x.id === id)?.title ?? id;
  let linked = 0, processed = 0;
  const t0 = Date.now();
  for (const f of slice) {
    processed++;
    try {
      const rel = await linkFactRelations(f, allFacts);
      const has = rel.prevFactIds.length > 0 || rel.nextFactIds.length > 0;
      if (has && !DRY) await setFactRelations(f.id, rel.prevFactIds, rel.nextFactIds);
      if (has) linked++;
      console.log(
        `[${processed}/${slice.length}] ${f.era}·${f.year ?? "?"} ${f.title}` +
          `\n     ← 원인: ${rel.prevFactIds.map(titleOf).join(", ") || "(없음)"}` +
          `\n     → 결과: ${rel.nextFactIds.map(titleOf).join(", ") || "(없음)"}`
      );
    } catch (e: any) {
      console.error(`[${processed}/${slice.length}] ${f.id} 실패:`, e.message);
    }
    if (processed % 25 === 0) {
      const rate = ((Date.now() - t0) / processed / 1000).toFixed(1);
      console.log(`--- 진행 ${processed}/${slice.length} · 연결 ${linked} · 평균 ${rate}s/건 ---`);
    }
  }
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  console.log(`\n=== 완료 === 처리 ${processed} · 관계 생성 ${linked} · 소요 ${mins}분${DRY ? " (DRY, 미기록)" : ""}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
