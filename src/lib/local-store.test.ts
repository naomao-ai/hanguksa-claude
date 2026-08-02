import { describe, it, expect } from "vitest";
import {
  checkInToday, recordExamResult, latestExam, weakestEra,
  roundAttemptCounts, nextTargetRound, weakErasFromRound,
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

function rAttempt(round: number, qid: string, correct: boolean, era = "goryeo", level = "SIMHWA"): Attempt {
  return { questionId: qid, correct, selected: 0, ts: 0, era, qType: "기타", level, examRound: round };
}

describe("roundAttemptCounts", () => {
  it("회차별 고유 문항 수를 센다(중복 문항 1회)", () => {
    const s = store();
    s.attempts = [
      rAttempt(77, "a", true), rAttempt(77, "a", false), rAttempt(77, "b", true),
      rAttempt(76, "c", true),
    ];
    expect(roundAttemptCounts(s)).toEqual({ 77: 2, 76: 1 });
  });

  it("등급 필터가 적용된다", () => {
    const s = store();
    s.attempts = [rAttempt(77, "a", true, "goryeo", "SIMHWA"), rAttempt(77, "b", true, "goryeo", "GIBON")];
    expect(roundAttemptCounts(s, "SIMHWA")).toEqual({ 77: 1 });
  });

  it("examRound 없는(구버전) 기록은 무시한다", () => {
    const s = store();
    s.attempts = [attempt("goryeo", true)]; // examRound 없음
    expect(roundAttemptCounts(s)).toEqual({});
  });
});

describe("nextTargetRound", () => {
  it("완료하지 않은 회차 중 가장 높은 회차를 고른다", () => {
    expect(nextTargetRound([77, 76, 75, 74], new Set([77, 75]))).toBe(76);
  });
  it("모두 완료면 null", () => {
    expect(nextTargetRound([76, 75], new Set([76, 75]))).toBeNull();
  });
  it("정렬되지 않은 입력도 처리한다", () => {
    expect(nextTargetRound([74, 77, 75], new Set([77]))).toBe(75);
  });
});

describe("weakErasFromRound", () => {
  it("해당 회차 오답 시대를 빈도 내림차순으로 반환", () => {
    const s = store();
    s.attempts = [
      rAttempt(77, "a", false, "joseon"), rAttempt(77, "b", false, "joseon"),
      rAttempt(77, "c", false, "goryeo"), rAttempt(77, "d", true, "samguk"),
      rAttempt(76, "e", false, "gaya"), // 다른 회차는 제외
    ];
    expect(weakErasFromRound(s, 77)).toEqual(["joseon", "goryeo"]);
  });
  it("정답 문항만 있으면 빈 배열", () => {
    const s = store();
    s.attempts = [rAttempt(77, "a", true, "joseon")];
    expect(weakErasFromRound(s, 77)).toEqual([]);
  });
});
