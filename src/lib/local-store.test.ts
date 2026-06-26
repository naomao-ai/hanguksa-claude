import { describe, it, expect } from "vitest";
import { checkInToday, type Store } from "./local-store";

function store(att?: Partial<Store["attendance"]>): Store {
  return {
    attempts: [], srs: {}, bookmarks: {} as never, flashcards: {},
    streak: { current: 0, longest: 0, lastDay: null, studyDays: [] },
    settings: { examDate: null, targetLevel: "SIMHWA", targetGrade: 1 },
    badges: [],
    attendance: { lastDay: null, total: 0, current: 0, longest: 0, ...att },
  } as unknown as Store;
}

describe("checkInToday", () => {
  it("첫 출석은 누적·연속 1", () => {
    const s = checkInToday(store(), "2026-06-26");
    expect(s.attendance).toEqual({ lastDay: "2026-06-26", total: 1, current: 1, longest: 1 });
  });

  it("같은 날 재방문은 멱등(변화 없음)", () => {
    const base = store({ lastDay: "2026-06-26", total: 1, current: 1, longest: 1 });
    const s = checkInToday(base, "2026-06-26");
    expect(s.attendance).toEqual(base.attendance);
  });

  it("어제 방문했으면 연속 증가", () => {
    const base = store({ lastDay: "2026-06-25", total: 3, current: 3, longest: 3 });
    const s = checkInToday(base, "2026-06-26");
    expect(s.attendance).toEqual({ lastDay: "2026-06-26", total: 4, current: 4, longest: 4 });
  });

  it("하루 이상 끊기면 연속 1로 리셋(누적·최장은 유지)", () => {
    const base = store({ lastDay: "2026-06-20", total: 5, current: 5, longest: 5 });
    const s = checkInToday(base, "2026-06-26");
    expect(s.attendance).toEqual({ lastDay: "2026-06-26", total: 6, current: 1, longest: 5 });
  });
});
