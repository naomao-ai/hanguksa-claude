import { describe, it, expect } from "vitest";
import { adjacentEras, FACT_CATEGORIES, ERA_KEYS } from "./domain";

describe("adjacentEras", () => {
  it("중간 시대는 직전·자신·직후 3개", () => {
    expect(adjacentEras("goryeo")).toEqual(["nambukguk", "goryeo", "joseon"]);
  });
  it("첫 시대는 자신·직후 2개", () => {
    expect(adjacentEras("prehistoric")).toEqual(["prehistoric", "gojoseon"]);
  });
  it("마지막 시대는 직전·자신 2개", () => {
    expect(adjacentEras("contemporary")).toEqual(["japanese", "contemporary"]);
  });
  it("알 수 없는 키는 빈 배열", () => {
    expect(adjacentEras("unknown")).toEqual([]);
  });
});

describe("FACT_CATEGORIES", () => {
  it("5개 주제 분류", () => {
    expect(FACT_CATEGORIES).toEqual(["정치", "경제", "사회", "문화", "대외관계"]);
  });
  it("모든 시대 키가 9개", () => {
    expect(ERA_KEYS).toHaveLength(9);
  });
});
