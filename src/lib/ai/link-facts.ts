import { adjacentEras } from "@/lib/domain";
import type { FactDTO, QuestionDTO } from "@/lib/types";

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
