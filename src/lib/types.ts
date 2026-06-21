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
  choices: { id: string; order: number; text: string }[];
}

export interface FactDTO {
  id: string;
  era: string;
  year: number | null;
  title: string;
  kind: string;
  body: string;
  relatedTo: string[];
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
