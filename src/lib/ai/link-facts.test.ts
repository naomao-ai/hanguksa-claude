import { describe, it, expect } from "vitest";
import { candidateFacts, sanitizeFactIds } from "./link-facts";
import type { FactDTO, QuestionDTO } from "@/lib/types";

function fact(id: string, era: string, year: number): FactDTO {
  return { id, era, year, title: id, kind: "event", body: "", relatedTo: [], period: null, category: null, importance: null, keywords: [], prevFactIds: [], nextFactIds: [], detail: [] };
}
function question(era: string): QuestionDTO {
  return { id: "q1", level: "SIMHWA", examRound: null, examYear: null, number: null, stem: "", passage: null, imageUrl: null, imageDescription: null, explanation: null, answerIndex: 0, era, topics: [], qType: "기타", difficulty: null, source: "MANUAL", factIds: [], choices: [] };
}

describe("candidateFacts", () => {
  it("문제 era의 인접 시대 facts만 포함", () => {
    const facts = [fact("a", "nambukguk", 500), fact("b", "goryeo", 1000), fact("c", "joseon", 1500), fact("d", "modern", 1880)];
    const res = candidateFacts(question("goryeo"), facts);
    expect(res.map((f) => f.id).sort()).toEqual(["a", "b", "c"]); // nambukguk/goryeo/joseon 인접
  });
  it("year 오름차순 정렬", () => {
    const facts = [fact("late", "goryeo", 1300), fact("early", "goryeo", 950)];
    expect(candidateFacts(question("goryeo"), facts).map((f) => f.id)).toEqual(["early", "late"]);
  });
});

describe("sanitizeFactIds", () => {
  it("후보에 없는 id는 제거", () => {
    expect(sanitizeFactIds(["a", "x"], ["a", "b"])).toEqual(["a"]);
  });
  it("중복 제거 + 최대 개수 제한", () => {
    expect(sanitizeFactIds(["a", "a", "b", "c"], ["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
  it("배열이 아니면 빈 배열", () => {
    expect(sanitizeFactIds("nope", ["a"])).toEqual([]);
  });
});
