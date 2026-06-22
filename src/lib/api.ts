"use client";

import type { QuestionDTO, FactDTO, VideoDTO } from "./types";

export interface QuestionFilter {
  level?: string;
  era?: string;
  qType?: string;
  topic?: string;
  round?: string;
  q?: string;
  factId?: string;
  limit?: number;
  random?: boolean;
}

export async function fetchQuestions(f: QuestionFilter = {}, signal?: AbortSignal): Promise<QuestionDTO[]> {
  const sp = new URLSearchParams();
  if (f.level) sp.set("level", f.level);
  if (f.era) sp.set("era", f.era);
  if (f.qType) sp.set("qType", f.qType);
  if (f.topic) sp.set("topic", f.topic);
  if (f.round) sp.set("round", f.round);
  if (f.q) sp.set("q", f.q);
  if (f.factId) sp.set("factId", f.factId);
  if (f.limit) sp.set("limit", String(f.limit));
  if (f.random) sp.set("random", "1");
  const res = await fetch(`/api/questions?${sp.toString()}`, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return data.questions ?? [];
}

// 서버에서 ids로 직접 조회 (전체 적재 없이 효율적)
export async function fetchQuestionsByIds(ids: string[]): Promise<QuestionDTO[]> {
  if (ids.length === 0) return [];
  const res = await fetch(`/api/questions?ids=${encodeURIComponent(ids.join(","))}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.questions ?? [];
}

export async function fetchRounds(): Promise<number[]> {
  try {
    const res = await fetch("/api/rounds");
    if (!res.ok) return [];
    const data = await res.json();
    return data.rounds ?? [];
  } catch {
    return [];
  }
}

export async function fetchFacts(era?: string): Promise<FactDTO[]> {
  const sp = new URLSearchParams();
  if (era) sp.set("era", era);
  const res = await fetch(`/api/facts?${sp.toString()}`);
  const data = await res.json();
  return data.facts ?? [];
}

export async function fetchVideos(): Promise<VideoDTO[]> {
  const res = await fetch("/api/videos");
  if (!res.ok) return [];
  const data = await res.json();
  return data.videos ?? [];
}
