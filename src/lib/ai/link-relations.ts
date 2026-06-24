import { adjacentEras } from "@/lib/domain";
import type { FactDTO } from "@/lib/types";

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
