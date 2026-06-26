import { describe, it, expect } from "vitest";
import { buildFactMap, resolveRelations, pushPath } from "./network";
import type { FactDTO } from "@/lib/types";

function fact(id: string, prev: string[] = [], next: string[] = []): FactDTO {
  return { id, era: "goryeo", year: 1000, title: id, kind: "event", body: "", relatedTo: [], period: null, category: null, importance: null, keywords: [], prevFactIds: prev, nextFactIds: next, detail: [] };
}

describe("buildFactMap", () => {
  it("id로 조회 가능한 맵", () => {
    const m = buildFactMap([fact("a"), fact("b")]);
    expect(m.get("a")?.id).toBe("a");
    expect(m.size).toBe(2);
  });
});

describe("resolveRelations", () => {
  it("id를 fact로 해석, 없는 id 제외", () => {
    const map = buildFactMap([fact("c"), fact("self", ["c"], ["missing"])]);
    const r = resolveRelations(map.get("self")!, map);
    expect(r.prev.map((f) => f.id)).toEqual(["c"]);
    expect(r.next).toEqual([]);
  });
});

describe("pushPath", () => {
  it("새 id는 추가", () => {
    expect(pushPath(["a"], "b")).toEqual(["a", "b"]);
  });
  it("기존 id면 그 지점까지 되돌아감", () => {
    expect(pushPath(["a", "b", "c"], "a")).toEqual(["a"]);
  });
  it("최대 길이 초과 시 앞에서 제거", () => {
    expect(pushPath(["a", "b"], "c", 2)).toEqual(["b", "c"]);
  });
});
