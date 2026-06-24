import type { FactDTO } from "@/lib/types";

export function buildFactMap(facts: FactDTO[]): Map<string, FactDTO> {
  return new Map(facts.map((f) => [f.id, f]));
}

export function resolveRelations(
  fact: FactDTO,
  map: Map<string, FactDTO>
): { prev: FactDTO[]; next: FactDTO[] } {
  const pick = (ids: string[]) => ids.map((id) => map.get(id)).filter((f): f is FactDTO => !!f);
  return { prev: pick(fact.prevFactIds), next: pick(fact.nextFactIds) };
}

/** breadcrumb 경로 갱신. 기존 id면 되돌아가고, 새 id면 추가(최대 max). */
export function pushPath(path: string[], id: string, max: number = 100): string[] {
  const i = path.indexOf(id);
  if (i >= 0) return path.slice(0, i + 1);
  const next = [...path, id];
  return next.length > max ? next.slice(next.length - max) : next;
}
