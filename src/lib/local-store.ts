"use client";

import { initialSrs, reviewSrs, toGrade, type SrsState } from "./srs";

/**
 * 계정 없는 앱 — 개인 학습 기록을 브라우저 localStorage에 저장.
 * 내보내기/가져오기(JSON)로 기기 간 백업 지원.
 */

const KEY = "hanguksa:v1";

/** 풀이 맥락 — 실전(모의고사) 정답률과 복습 정답률을 구분하기 위함 */
export type AttemptSource = "study" | "review" | "exam" | "warmup";

export interface Attempt {
  questionId: string;
  correct: boolean;
  selected: number | null;
  ts: number;
  era: string;
  qType: string;
  level: string;
  /** 풀이 맥락 (없으면 구버전 기록) */
  source?: AttemptSource;
}

/** 모의고사 1회 결과 — "나 지금 합격권인가?"의 근거 데이터 */
export interface ExamRecord {
  ts: number;
  level: "SIMHWA" | "GIBON";
  /** 100점 만점 환산 점수 */
  score100: number;
  correct: number;
  total: number;
  /** 합격 급수 (불합격이면 null) */
  grade: number | null;
  passed: boolean;
}

export interface Settings {
  examDate: string | null; // YYYY-MM-DD
  targetLevel: "SIMHWA" | "GIBON";
  targetGrade: number | null;
}

export interface Streak {
  current: number;
  longest: number;
  lastDay: string | null; // YYYY-MM-DD
  studyDays: string[]; // 학습한 날짜 목록
}

/** 방문(앱 열기) 기준 출석 — 풀이 기준 streak와 별개 */
export interface Attendance {
  lastDay: string | null; // YYYY-MM-DD
  total: number; // 누적 출석일 수
  current: number; // 연속 출석일 수
  longest: number; // 최장 연속
}

export interface Store {
  attempts: Attempt[];
  srs: Record<string, SrsState>; // questionId -> 상태
  bookmarks: string[]; // questionId
  flashcards: Record<string, SrsState>; // factTitle -> 상태
  streak: Streak;
  settings: Settings;
  badges: string[];
  attendance: Attendance;
  /** 모의고사 응시 이력 (시간순) */
  examHistory: ExamRecord[];
}

function emptyStore(): Store {
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

export function loadStore(): Store {
  if (typeof window === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    return { ...emptyStore(), ...JSON.parse(raw) };
  } catch {
    return emptyStore();
  }
}

export function saveStore(s: Store) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
  // 같은 탭 내 구독자에게 변경 통지
  window.dispatchEvent(new CustomEvent("hanguksa:store"));
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 모의고사 결과 1회 기록 — 시간순 이력에 추가 (순수 함수) */
export function recordExamResult(
  s: Store,
  r: Omit<ExamRecord, "ts">,
  now = Date.now()
): Store {
  return { ...s, examHistory: [...s.examHistory, { ...r, ts: now }] };
}

/** 가장 최근 모의고사 기록 (없으면 null) */
export function latestExam(s: Store): ExamRecord | null {
  return s.examHistory.length ? s.examHistory[s.examHistory.length - 1] : null;
}

/** 풀이 결과 1건 기록 — attempts, SRS, 스트릭, 배지를 함께 갱신 */
export function recordAttempt(
  s: Store,
  a: Omit<Attempt, "ts">,
  perceived?: "easy" | "normal" | "hard"
): Store {
  const now = Date.now();
  const attempt: Attempt = { ...a, ts: now };
  const attempts = [...s.attempts, attempt];

  // SRS 갱신
  const prev = s.srs[a.questionId] ?? initialSrs(now);
  const grade = toGrade(a.correct, perceived);
  const srs = { ...s.srs, [a.questionId]: reviewSrs(prev, grade, now) };

  // 스트릭 갱신
  const streak = updateStreak(s.streak, todayStr());

  const next: Store = { ...s, attempts, srs, streak };
  return awardBadges(next);
}

function updateStreak(streak: Streak, day: string): Streak {
  if (streak.lastDay === day) return streak;
  const studyDays = streak.studyDays.includes(day)
    ? streak.studyDays
    : [...streak.studyDays, day];
  let current = 1;
  if (streak.lastDay) {
    const diff = Math.round(
      (new Date(day).getTime() - new Date(streak.lastDay).getTime()) / 86_400_000
    );
    current = diff === 1 ? streak.current + 1 : 1;
  }
  return {
    current,
    longest: Math.max(streak.longest, current),
    lastDay: day,
    studyDays,
  };
}

/** 방문 출석 체크 — 오늘 첫 방문이면 누적·연속 갱신(멱등). 순수 함수. */
export function checkInToday(s: Store, day: string): Store {
  const a = s.attendance;
  if (a.lastDay === day) return s;
  let current = 1;
  if (a.lastDay) {
    const diff = Math.round(
      (new Date(day).getTime() - new Date(a.lastDay).getTime()) / 86_400_000
    );
    current = diff === 1 ? a.current + 1 : 1;
  }
  return {
    ...s,
    attendance: {
      lastDay: day,
      total: a.total + 1,
      current,
      longest: Math.max(a.longest, current),
    },
  };
}

const BADGE_RULES: { id: string; label: string; test: (s: Store) => boolean }[] = [
  { id: "first-step", label: "첫걸음", test: (s) => s.attempts.length >= 1 },
  { id: "ten", label: "10문항 돌파", test: (s) => s.attempts.length >= 10 },
  { id: "fifty", label: "50문항 돌파", test: (s) => s.attempts.length >= 50 },
  { id: "century", label: "100문항 돌파", test: (s) => s.attempts.length >= 100 },
  { id: "streak3", label: "3일 연속", test: (s) => s.streak.current >= 3 },
  { id: "streak7", label: "7일 연속", test: (s) => s.streak.longest >= 7 },
  {
    id: "sharpshooter",
    label: "명사수 (정답률 90%↑)",
    test: (s) =>
      s.attempts.length >= 20 &&
      s.attempts.filter((a) => a.correct).length / s.attempts.length >= 0.9,
  },
];

function awardBadges(s: Store): Store {
  const earned = new Set(s.badges);
  for (const r of BADGE_RULES) if (r.test(s)) earned.add(r.id);
  return { ...s, badges: [...earned] };
}

export function badgeLabel(id: string): string {
  return BADGE_RULES.find((b) => b.id === id)?.label ?? id;
}

export const ALL_BADGES = BADGE_RULES.map((b) => ({ id: b.id, label: b.label }));

/**
 * 정답률이 가장 낮은 시대 키 (minAttempts회 이상 푼 시대 중). 없으면 null.
 * 워밍업·추천 출제를 취약 영역에 가중하기 위한 근거.
 */
export function weakestEra(s: Store, minAttempts = 3): string | null {
  const m: Record<string, { c: number; n: number }> = {};
  for (const a of s.attempts) {
    m[a.era] ??= { c: 0, n: 0 };
    m[a.era].n++;
    if (a.correct) m[a.era].c++;
  }
  let worst: string | null = null;
  let worstAcc = Infinity;
  for (const [era, v] of Object.entries(m)) {
    if (v.n < minAttempts) continue;
    const acc = v.c / v.n;
    if (acc < worstAcc) {
      worstAcc = acc;
      worst = era;
    }
  }
  return worst;
}

/** 오늘 복습 대상(due) questionId 목록 */
export function dueQuestionIds(s: Store, now = Date.now()): string[] {
  return Object.entries(s.srs)
    .filter(([, st]) => st.due <= now)
    .map(([id]) => id);
}

/** 최근 오답 questionId (중복 제거, 최신순) */
export function wrongQuestionIds(s: Store): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = s.attempts.length - 1; i >= 0; i--) {
    const a = s.attempts[i];
    if (seen.has(a.questionId)) continue;
    seen.add(a.questionId);
    if (!a.correct) out.push(a.questionId);
  }
  return out;
}

export function toggleBookmark(s: Store, id: string): Store {
  const has = s.bookmarks.includes(id);
  return {
    ...s,
    bookmarks: has ? s.bookmarks.filter((x) => x !== id) : [...s.bookmarks, id],
  };
}

export function reviewFlashcard(
  s: Store,
  title: string,
  grade: number
): Store {
  const now = Date.now();
  const prev = s.flashcards[title] ?? initialSrs(now);
  return {
    ...s,
    flashcards: { ...s.flashcards, [title]: reviewSrs(prev, grade, now) },
  };
}
