/**
 * 한국사능력검정시험 도메인 상수
 * 시대 구분 / 문항 유형 / 등급 등 앱 전역에서 공유.
 */

export type Level = "SIMHWA" | "GIBON";

export const LEVELS: { value: Level; label: string; sub: string }[] = [
  { value: "SIMHWA", label: "심화", sub: "1~3급" },
  { value: "GIBON", label: "기본", sub: "4~6급" },
];

export function levelLabel(v: Level): string {
  return v === "SIMHWA" ? "심화" : "기본";
}

/** 시대 구분 — 한국사 흐름 순서대로 정렬. color는 시각화(연표/히트맵)용. */
export interface EraDef {
  key: string;
  label: string;
  /** 대략 시작 연도 (음수 = 기원전) — 타임라인 정렬용 */
  start: number;
  /** 대략 종료 연도 */
  end: number;
  color: string;
}

export const ERAS: EraDef[] = [
  { key: "prehistoric", label: "선사 시대", start: -700000, end: -2333, color: "#8d6e63" },
  { key: "gojoseon", label: "고조선·연맹왕국", start: -2333, end: -57, color: "#a1887f" },
  { key: "samguk", label: "삼국 시대", start: -57, end: 676, color: "#ef6c00" },
  { key: "nambukguk", label: "남북국 시대", start: 676, end: 935, color: "#f9a825" },
  { key: "goryeo", label: "고려 시대", start: 918, end: 1392, color: "#2e7d32" },
  { key: "joseon", label: "조선 시대", start: 1392, end: 1863, color: "#1565c0" },
  { key: "modern", label: "근대 (개항기)", start: 1863, end: 1910, color: "#6a1b9a" },
  { key: "japanese", label: "일제 강점기", start: 1910, end: 1945, color: "#b71c1c" },
  { key: "contemporary", label: "현대", start: 1945, end: 2025, color: "#00838f" },
];

export const ERA_KEYS = ERAS.map((e) => e.key);

/** 연표 항목 주제 분류 */
export const FACT_CATEGORIES = ["정치", "경제", "사회", "문화", "대외관계"] as const;

/** 한 시대와 시간상 인접한(직전·자신·직후) 시대 키. AI 연결 후보 범위 산정용. */
export function adjacentEras(eraKey: string): string[] {
  const i = ERA_KEYS.indexOf(eraKey);
  if (i < 0) return [];
  return ERA_KEYS.slice(Math.max(0, i - 1), i + 2);
}

export function eraDef(key: string): EraDef | undefined {
  return ERAS.find((e) => e.key === key);
}

export function eraLabel(key: string): string {
  return eraDef(key)?.label ?? key;
}

export function eraColor(key: string): string {
  return eraDef(key)?.color ?? "#64748b";
}

/** 문항 유형 — 한능검 빈출 형태 */
export const QUESTION_TYPES = [
  { key: "자료제시형", label: "자료 제시형", desc: "사료·사진·지도 등 자료 해석" },
  { key: "순서나열형", label: "순서 나열형", desc: "사건의 시간 순서 배열" },
  { key: "인물형", label: "인물 중심형", desc: "특정 인물의 활동·업적" },
  { key: "지도형", label: "지도·문화재형", desc: "지도·유물·문화유산 식별" },
  { key: "개념형", label: "개념·제도형", desc: "제도·정책·개념 이해" },
  { key: "기타", label: "기타", desc: "분류 외" },
] as const;

export type QuestionTypeKey = (typeof QUESTION_TYPES)[number]["key"];

export function qTypeLabel(key: string): string {
  return QUESTION_TYPES.find((q) => q.key === key)?.label ?? key;
}

/** 심화/기본 점수 → 급수 환산 (한능검 공식 기준: 100점 만점) */
export interface GradeResult {
  grade: number | null; // 1~6, null = 불합격
  label: string;
  passed: boolean;
}

export function scoreToGrade(level: Level, score100: number): GradeResult {
  if (level === "SIMHWA") {
    // 심화: 80+ 1급, 70+ 2급, 60+ 3급, 미만 불합격
    if (score100 >= 80) return { grade: 1, label: "1급", passed: true };
    if (score100 >= 70) return { grade: 2, label: "2급", passed: true };
    if (score100 >= 60) return { grade: 3, label: "3급", passed: true };
    return { grade: null, label: "불합격", passed: false };
  }
  // 기본: 80+ 4급, 70+ 5급, 60+ 6급, 미만 불합격
  if (score100 >= 80) return { grade: 4, label: "4급", passed: true };
  if (score100 >= 70) return { grade: 5, label: "5급", passed: true };
  if (score100 >= 60) return { grade: 6, label: "6급", passed: true };
  return { grade: null, label: "불합격", passed: false };
}

/** 한능검은 50문항 (각 2점, 100점 만점)이 표준 */
export const EXAM_TOTAL_QUESTIONS = 50;
export const EXAM_DURATION_MIN = 80; // 시험 시간(분)
export const POINTS_PER_QUESTION = 2;
