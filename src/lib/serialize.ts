import type { QuestionDTO, FactDTO, VideoDTO } from "./types";
import type { Level } from "./domain";

function parseJsonArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// Prisma 결과(choices 포함)를 클라이언트 DTO로 변환
export function toQuestionDTO(q: {
  id: string;
  level: string;
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
  topics: string;
  qType: string;
  difficulty: number | null;
  source: string;
  choices: { id: string; order: number; text: string }[];
}): QuestionDTO {
  return {
    id: q.id,
    level: q.level as Level,
    examRound: q.examRound,
    examYear: q.examYear,
    number: q.number,
    stem: q.stem,
    passage: q.passage,
    imageUrl: q.imageUrl,
    imageDescription: q.imageDescription,
    explanation: q.explanation,
    answerIndex: q.answerIndex,
    era: q.era,
    topics: parseJsonArray(q.topics),
    qType: q.qType,
    difficulty: q.difficulty,
    source: q.source,
    choices: [...q.choices].sort((a, b) => a.order - b.order),
  };
}

export function toFactDTO(f: {
  id: string;
  era: string;
  year: number | null;
  title: string;
  kind: string;
  body: string;
  relatedTo: string;
}): FactDTO {
  return { ...f, relatedTo: parseJsonArray(f.relatedTo) };
}

export function toVideoDTO(v: {
  id: string;
  youtubeId: string;
  url: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string | null;
  publishedAt: Date;
  aiAnalysis: string;
  summary: string;
}): VideoDTO {
  return {
    id: v.id,
    youtubeId: v.youtubeId,
    url: v.url,
    title: v.title,
    channel: v.channel,
    thumbnailUrl: v.thumbnailUrl,
    publishedAt: v.publishedAt.toISOString(),
    aiAnalysis: v.aiAnalysis,
    summary: v.summary,
  };
}
