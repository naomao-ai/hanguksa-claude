import { describe, it, expect } from "vitest";
import { sanitizeDetail } from "./generate-details";

describe("sanitizeDetail", () => {
  it("문자열 배열을 trim하고 빈 항목 제거", () => {
    expect(sanitizeDetail([" 광종 즉위 ", "", "  ", "노비안검법"])).toEqual(["광종 즉위", "노비안검법"]);
  });
  it("문자열 아닌 항목 제거", () => {
    expect(sanitizeDetail(["a", 3, null, "b"])).toEqual(["a", "b"]);
  });
  it("최대 개수 제한", () => {
    expect(sanitizeDetail(["a", "b", "c", "d"], 2)).toEqual(["a", "b"]);
  });
  it("배열이 아니면 빈 배열", () => {
    expect(sanitizeDetail("nope")).toEqual([]);
  });
  it("중복 제거", () => {
    expect(sanitizeDetail(["a", "a", "b"])).toEqual(["a", "b"]);
  });
});
