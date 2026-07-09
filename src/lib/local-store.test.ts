import { describe, it, expect } from "vitest";
import {
  checkInToday, recordExamResult, latestExam, weakestEra,
  type Store, type Attempt,
} from "./local-store";

function store(att?: Partial<Store["attendance"]>): Store {
  return {
    attempts: [], srs: {}, bookmarks: {} as never, flashcards: {},
    streak: { current: 0, longest: 0, lastDay: null, studyDays: [] },
    settings: { examDate: null, targetLevel: "SIMHWA", targetGrade: 1 },
    badges: [],
    attendance: { lastDay: null, total: 0, current: 0, longest: 0, ...att },
    examHistory: [],
  } as unknown as Store;
}

function attempt(era: string, correct: boolean): Attempt {
  return { questionId: "q", correct, selected: 0, ts: 0, era, qType: "기타", level: "SIMHWA" };
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

describe("recordExamResult / latestExam", () => {
  it("모의고사 결과를 시간순으로 누적하고 최신 기록을 돌려준다", () => {
    let s = store();
    expect(latestExam(s)).toBeNull();
    s = recordExamResult(s, { level: "SIMHWA", score100: 58, correct: 29, total: 50, grade: null, passed: false }, 1000);
    s = recordExamResult(s, { level: "SIMHWA", score100: 72, correct: 36, total: 50, grade: 2, passed: true }, 2000);
    expect(s.examHistory).toHaveLength(2);
    expect(latestExam(s)).toMatchObject({ ts: 2000, score100: 72, grade: 2, passed: true });
  });
});

describe("weakestEra", () => {
  it("최소 풀이 수를 넘긴 시대 중 정답률이 가장 낮은 시대를 고른다", () => {
    const s = store();
    s.attempts = [
      // goryeo: 1/3 (33%)
      attempt("goryeo", true), attempt("goryeo", false), attempt("goryeo", false),
      // joseon: 3/3 (100%)
      attempt("joseon", true), attempt("joseon", true), attempt("joseon", true),
      // samguk: 0/2 — 표본 부족(<3)이라 제외
      attempt("samguk", false), attempt("samguk", false),
    ];
    expect(weakestEra(s)).toBe("goryeo");
  });

  it("표본이 충분한 시대가 없으면 null", () => {
    const s = store();
    s.attempts = [attempt("goryeo", false)];
    expect(weakestEra(s)).toBeNull();
  });
});
