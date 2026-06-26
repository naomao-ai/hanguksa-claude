import { describe, it, expect } from "vitest";
import { candidateFactsForFact, sanitizeRelations } from "./link-relations";
import type { FactDTO } from "@/lib/types";

function fact(id: string, era: string, year: number): FactDTO {
  return { id, era, year, title: id, kind: "event", body: "", relatedTo: [], period: null, category: null, importance: null, keywords: [], prevFactIds: [], nextFactIds: [], detail: [] };
}

describe("candidateFactsForFact", () => {
  it("인접 시대 + 자기 자신 제외", () => {
    const facts = [fact("self", "goryeo", 1000), fact("a", "nambukguk", 500), fact("b", "joseon", 1500), fact("c", "modern", 1880)];
    const res = candidateFactsForFact(fact("self", "goryeo", 1000), facts);
    expect(res.map((f) => f.id).sort()).toEqual(["a", "b"]); // nambukguk/goryeo/joseon 중 self·modern 제외
  });
  it("year 오름차순", () => {
    const facts = [fact("late", "goryeo", 1300), fact("early", "goryeo", 950), fact("x", "goryeo", 1000)];
    expect(candidateFactsForFact(fact("x", "goryeo", 1000), facts).map((f) => f.id)).toEqual(["early", "late"]);
  });
});

describe("sanitizeRelations", () => {
  it("후보 화이트리스트·self 제외", () => {
    const r = sanitizeRelations({ prevFactIds: ["a", "self", "x"], nextFactIds: ["b"] }, ["a", "b"], "self");
    expect(r).toEqual({ prevFactIds: ["a"], nextFactIds: ["b"] });
  });
  it("prev/next 중복 시 prev 우선·next에서 제거", () => {
    const r = sanitizeRelations({ prevFactIds: ["a"], nextFactIds: ["a", "b"] }, ["a", "b"], "self");
    expect(r).toEqual({ prevFactIds: ["a"], nextFactIds: ["b"] });
  });
  it("각 최대 개수 제한·중복 제거", () => {
    const r = sanitizeRelations({ prevFactIds: ["a", "a", "b", "c"], nextFactIds: [] }, ["a", "b", "c"], "self", 2);
    expect(r).toEqual({ prevFactIds: ["a", "b"], nextFactIds: [] });
  });
  it("배열 아니면 빈 결과", () => {
    expect(sanitizeRelations("nope", ["a"], "self")).toEqual({ prevFactIds: [], nextFactIds: [] });
  });
});
