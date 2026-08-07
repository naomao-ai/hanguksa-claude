import { describe, it, expect } from "vitest";
import { mergeStores } from "./sync-merge";
import type { Store } from "./local-store";

function base(): Store {
  return {
    attempts: [],
    srs: {},
    bookmarks: [],
    flashcards: {},
    streak: { current: 0, longest: 0, lastDay: null, studyDays: [] },
    settings: { examDate: null, targetLevel: "SIMHWA", targetGrade: 1 },
    badges: [],
    attendance: { lastDay: null, total: 0, current: 0, longest: 0 },
    examHistory: [],
  };
}

const att = (ts: number, qid: string, correct = true) => ({
  questionId: qid, correct, selected: 0, ts, era: "joseon", qType: "자료제시형", level: "SIMHWA",
});

describe("mergeStores — 손실 없는 병합", () => {
  it("로컬에만 있는 attempts를 보존한다(덮어쓰기 방지)", () => {
    const local = { ...base(), attempts: [att(1, "q1"), att(2, "q2")] };
    const cloud = { attempts: [att(3, "q3")] };
    const m = mergeStores(local, cloud);
    expect(m.attempts.map((a) => a.questionId)).toEqual(["q1", "q2", "q3"]);
  });

  it("동일 시각·문항 attempt는 중복 제거한다", () => {
    const local = { ...base(), attempts: [att(1, "q1")] };
    const cloud = { attempts: [att(1, "q1"), att(2, "q2")] };
    const m = mergeStores(local, cloud);
    expect(m.attempts).toHaveLength(2);
  });

  it("bookmarks·badges는 합집합", () => {
    const local = { ...base(), bookmarks: ["a", "b"], badges: ["first-step"] };
    const cloud = { bookmarks: ["b", "c"], badges: ["ten"] };
    const m = mergeStores(local, cloud);
    expect(m.bookmarks.sort()).toEqual(["a", "b", "c"]);
    expect(m.badges.sort()).toEqual(["first-step", "ten"]);
  });

  it("SRS는 due가 더 미래(최근 학습)인 쪽을 채택", () => {
    const local = { ...base(), srs: { q1: { repetition: 1, easeFactor: 2.5, interval: 6, due: 100 } } };
    const cloud = { srs: { q1: { repetition: 2, easeFactor: 2.6, interval: 15, due: 500 }, q2: { repetition: 0, easeFactor: 2.5, interval: 0, due: 50 } } };
    const m = mergeStores(local, cloud);
    expect(m.srs.q1.due).toBe(500); // 클라우드가 더 최근
    expect(m.srs.q2).toBeDefined();  // 로컬에 없던 것도 추가
  });

  it("로컬 SRS가 더 최근이면 로컬을 유지", () => {
    const local = { ...base(), srs: { q1: { repetition: 3, easeFactor: 2.7, interval: 30, due: 900 } } };
    const cloud = { srs: { q1: { repetition: 1, easeFactor: 2.5, interval: 6, due: 200 } } };
    const m = mergeStores(local, cloud);
    expect(m.srs.q1.due).toBe(900);
  });

  it("flashcards도 병합한다(기존 다운로드에서 누락됐던 필드)", () => {
    const local = { ...base(), flashcards: { "고려-광종": { repetition: 1, easeFactor: 2.5, interval: 6, due: 300 } } };
    const cloud = { flashcards: { "조선-세종": { repetition: 0, easeFactor: 2.5, interval: 0, due: 10 } } };
    const m = mergeStores(local, cloud);
    expect(Object.keys(m.flashcards).sort()).toEqual(["고려-광종", "조선-세종"]);
  });

  it("streak는 longest 최대·studyDays 합집합, current는 최신 날짜 기준", () => {
    const local = { ...base(), streak: { current: 3, longest: 5, lastDay: "2026-08-05", studyDays: ["2026-08-04", "2026-08-05"] } };
    const cloud = { streak: { current: 1, longest: 8, lastDay: "2026-08-01", studyDays: ["2026-08-01"] } };
    const m = mergeStores(local, cloud);
    expect(m.streak.longest).toBe(8);
    expect(m.streak.current).toBe(3); // lastDay가 더 최근인 로컬
    expect(m.streak.studyDays).toEqual(["2026-08-01", "2026-08-04", "2026-08-05"]);
  });

  it("examHistory 합집합·시간순 정렬", () => {
    const e = (ts: number): any => ({ ts, level: "SIMHWA", score100: 80, correct: 40, total: 50, grade: 3, passed: true });
    const local = { ...base(), examHistory: [e(200)] };
    const cloud = { examHistory: [e(100), e(200)] };
    const m = mergeStores(local, cloud);
    expect(m.examHistory.map((x) => x.ts)).toEqual([100, 200]);
  });

  it("클라우드가 완전히 비어도 로컬을 그대로 보존", () => {
    const local = { ...base(), attempts: [att(1, "q1")], bookmarks: ["a"] };
    const m = mergeStores(local, {});
    expect(m.attempts).toHaveLength(1);
    expect(m.bookmarks).toEqual(["a"]);
  });
});
