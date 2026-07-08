import type { Level } from "./domain";

/** 클라이언트로 전달되는 문항 DTO (topics는 파싱된 배열) */
export interface QuestionDTO {
  id: string;
  level: Level;
  examRound: number | null;
  examYear: number | null;
  number: number | null;
  stem: string;
  passage: string | null;
  imageUrl: string | null;
  imageDescription: string | null;
  explanation: string | null;
  answerIndex: number;
  era: string;
  topics: string[];
  qType: string;
  difficulty: number | null;
  source: string;
  /** 연결된 연표(facts) 문서 ID 배열 */
  factIds: string[];
  choices: { id: string; order: number; text: string; imageUrl: string | null }[];
}

export interface FactDTO {
  id: string;
  era: string;
  year: number | null;
  title: string;
  kind: string;
  body: string;
  relatedTo: string[];
  /** 소시대/세부 시기 (예: "삼국-전성기") */
  period: string | null;
  /** 주제 분류: 정치/경제/사회/문화/대외관계 */
  category: string | null;
  /** 빈출·중요도 1~3 */
  importance: number | null;
  /** 문제 매칭·검색용 핵심어 */
  keywords: string[];
  /** 이전(배경·원인) 연표 문서 id */
  prevFactIds: string[];
  /** 이후(결과·영향) 연표 문서 id */
  nextFactIds: string[];
  /** 상세 설명 — 짧은 단문(불릿) 배열. 요약(body) 아래에 표시 */
  detail: string[];
  /** 이 연표에 연결된 문제 수 (getFacts가 채움) */
  questionCount?: number;
}

export interface VideoDTO {
  id: string;
  youtubeId: string;
  url: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  /** 영상 게시일 (ISO 문자열) */
  publishedAt: string;
  aiAnalysis: string;
  summary: string;
}
