import { describe, it, expect } from "vitest";
import { initialSrs, reviewSrs, toGrade, isDue } from "./srs";

describe("SM-2 SRS", () => {
  const now = 1_700_000_000_000;

  it("초기 상태는 즉시 복습 대상", () => {
    const s = initialSrs(now);
    expect(s.repetition).toBe(0);
    expect(s.easeFactor).toBe(2.5);
    expect(isDue(s, now)).toBe(true);
  });

  it("정답 시 간격이 1일→6일로 증가", () => {
    let s = initialSrs(now);
    s = reviewSrs(s, 4, now);
    expect(s.repetition).toBe(1);
    expect(s.interval).toBe(1);
    s = reviewSrs(s, 4, now);
    expect(s.repetition).toBe(2);
    expect(s.interval).toBe(6);
  });

  it("오답 시 반복이 0으로 초기화되고 단기 재노출", () => {
    let s = initialSrs(now);
    s = reviewSrs(s, 4, now);
    s = reviewSrs(s, 1, now); // 오답
    expect(s.repetition).toBe(0);
    expect(s.interval).toBe(0);
    expect(s.due).toBeLessThan(now + 86_400_000); // 하루 이내 재노출
  });

  it("용이도 계수는 1.3 미만으로 내려가지 않음", () => {
    let s = initialSrs(now);
    for (let i = 0; i < 10; i++) s = reviewSrs(s, 3, now);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  it("toGrade: 정오·체감 난이도 매핑", () => {
    expect(toGrade(false)).toBeLessThan(3);
    expect(toGrade(true, "easy")).toBe(5);
    expect(toGrade(true, "hard")).toBe(3);
    expect(toGrade(true)).toBe(4);
  });
});
