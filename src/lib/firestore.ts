import { db } from "./firebase-admin.ts";
import { Timestamp } from "firebase-admin/firestore";
import { uploadImageFromDataUrl, deleteImageByUrl } from "./storage.ts";
import type { QuestionDTO, FactDTO, VideoDTO } from "./types";
import type { Level } from "./domain";

/*
 * Firestore 데이터 계층 — 기존 Prisma 호출을 1:1로 대체.
 * 데이터셋이 작아(수백 문항) 검색·정렬·집계는 메모리에서 처리해
 * 복합 인덱스 관리 없이 동작하게 한다. Choice는 Question 문서에 배열로 내장.
 */

const COL = {
  questions: "questions",
  releases: "releases",
  facts: "facts",
  videos: "videos",
} as const;

// ───────────────────────── Question ─────────────────────────

interface StoredChoice {
  order: number;
  text: string;
  imageUrl?: string | null;
}

/** 선지 입력: 순수 텍스트(기존/AI) 또는 텍스트+이미지 객체 */
export type ChoiceInput = string | { text?: string; imageUrl?: string | null };

function docToQuestion(id: string, d: FirebaseFirestore.DocumentData): QuestionDTO {
  const choices: StoredChoice[] = Array.isArray(d.choices) ? d.choices : [];
  return {
    id,
    level: (d.level as Level) ?? "SIMHWA",
    examRound: d.examRound ?? null,
    examYear: d.examYear ?? null,
    number: d.number ?? null,
    stem: d.stem ?? "",
    passage: d.passage ?? null,
    imageUrl: d.imageUrl ?? null,
    imageDescription: d.imageDescription ?? null,
    explanation: d.explanation ?? null,
    answerIndex: d.answerIndex ?? 0,
    era: d.era ?? "joseon",
    topics: Array.isArray(d.topics) ? d.topics : [],
    qType: d.qType ?? "기타",
    difficulty: d.difficulty ?? null,
    source: d.source ?? "MANUAL",
    factIds: Array.isArray(d.factIds) ? d.factIds : [],
    choices: [...choices]
      .sort((a, b) => a.order - b.order)
      .map((c, i) => ({ id: String(i), order: c.order, text: c.text, imageUrl: c.imageUrl ?? null })),
  };
}

export interface QuestionFilter {
  level?: string;
  era?: string;
  qType?: string;
  topic?: string;
  round?: number;
  q?: string;
  random?: boolean;
  limit?: number;
  factId?: string;
}

function sortQuestions(rows: QuestionDTO[]): QuestionDTO[] {
  // examRound 내림차순(없으면 뒤로), 같은 회차 내 number 오름차순
  return rows.sort((a, b) => {
    const ar = a.examRound ?? -1;
    const br = b.examRound ?? -1;
    if (br !== ar) return br - ar;
    return (a.number ?? 0) - (b.number ?? 0);
  });
}

/** 전체 문항 조회 (집계/회차용) */
export async function getAllQuestions(): Promise<QuestionDTO[]> {
  const snap = await db.collection(COL.questions).get();
  return snap.docs.map((d) => docToQuestion(d.id, d.data()));
}

/** 필터·검색·정렬·제한 (questions GET) */
export async function getQuestions(f: QuestionFilter = {}): Promise<QuestionDTO[]> {
  let rows = await getAllQuestions();
  if (f.level === "SIMHWA" || f.level === "GIBON") rows = rows.filter((r) => r.level === f.level);
  if (f.era) rows = rows.filter((r) => r.era === f.era);
  if (f.qType) rows = rows.filter((r) => r.qType === f.qType);
  if (f.round != null) rows = rows.filter((r) => r.examRound === f.round);
  if (f.factId) rows = rows.filter((r) => r.factIds.includes(f.factId!));
  if (f.topic) rows = rows.filter((r) => r.topics.some((t) => t.includes(f.topic!)));
  if (f.q) {
    const q = f.q;
    rows = rows.filter(
      (r) => r.stem.includes(q) || r.topics.some((t) => t.includes(q)) || (r.passage ?? "").includes(q)
    );
  }
  rows = sortQuestions(rows);
  if (f.random) rows = rows.sort(() => Math.random() - 0.5);
  if (f.limit) rows = rows.slice(0, f.limit);
  return rows;
}

/** ids 순서 보존 일괄 조회 */
export async function getQuestionsByIds(ids: string[]): Promise<QuestionDTO[]> {
  const unique = [...new Set(ids)].slice(0, 500);
  if (unique.length === 0) return [];
  const snaps = await db.getAll(...unique.map((id) => db.collection(COL.questions).doc(id)));
  const map = new Map<string, QuestionDTO>();
  for (const s of snaps) if (s.exists) map.set(s.id, docToQuestion(s.id, s.data()!));
  return ids.map((id) => map.get(id)).filter((q): q is QuestionDTO => !!q);
}

export async function getQuestionById(id: string): Promise<QuestionDTO | null> {
  const s = await db.collection(COL.questions).doc(id).get();
  return s.exists ? docToQuestion(s.id, s.data()!) : null;
}

/** 단일 문항 생성 (MANUAL) */
export interface NewQuestion {
  level?: string;
  stem: string;
  passage?: string | null;
  imageUrl?: string | null;
  imageDescription?: string | null;
  choices: ChoiceInput[];
  answerIndex: number;
  explanation?: string | null;
  era: string;
  topics?: string[];
  qType?: string;
  difficulty?: number | null;
  examRound?: number | null;
  examYear?: number | null;
  number?: number | null;
  source?: string;
  factIds?: string[];
}

async function buildQuestionDoc(id: string, q: NewQuestion, defaultSource: string) {
  let imageUrl = q.imageUrl ?? null;
  if (imageUrl) imageUrl = await uploadImageFromDataUrl(imageUrl, id);
  // 선지: 문자열 또는 {text,imageUrl}. 이미지 data URL은 Storage로 업로드.
  const choices = await Promise.all(
    (q.choices ?? []).map(async (c, order) => {
      const text = typeof c === "string" ? c : (c.text ?? "");
      let cImg = typeof c === "string" ? null : (c.imageUrl ?? null);
      if (cImg) cImg = await uploadImageFromDataUrl(cImg, `${id}-c${order}`);
      return { order, text, imageUrl: cImg };
    })
  );
  return {
    level: q.level === "GIBON" ? "GIBON" : "SIMHWA",
    examRound: q.examRound ?? null,
    examYear: q.examYear ?? null,
    number: q.number ?? null,
    stem: q.stem,
    passage: q.passage ?? null,
    imageUrl,
    imageDescription: q.imageDescription ?? null,
    explanation: q.explanation ?? null,
    answerIndex: Number(q.answerIndex) || 0,
    era: q.era,
    topics: Array.isArray(q.topics) ? q.topics : [],
    qType: q.qType || "기타",
    difficulty: q.difficulty ?? null,
    source: q.source ?? defaultSource,
    choices,
    factIds: Array.isArray(q.factIds) ? q.factIds : [],
    createdAt: Timestamp.now(),
  };
}

export async function createQuestion(q: NewQuestion): Promise<QuestionDTO> {
  const ref = db.collection(COL.questions).doc();
  const data = await buildQuestionDoc(ref.id, q, "MANUAL");
  await ref.set(data);
  return docToQuestion(ref.id, data);
}

/** 기존 문항 전체 수정 (편집기). createdAt·source는 보존. */
export async function updateQuestion(id: string, q: NewQuestion): Promise<QuestionDTO | null> {
  const ref = db.collection(COL.questions).doc(id);
  const prev = await ref.get();
  if (!prev.exists) return null;
  const prevSource = prev.data()?.source ?? "MANUAL";
  const data = await buildQuestionDoc(id, { ...q, source: q.source ?? prevSource }, prevSource);
  // createdAt은 최초값 유지
  const patch: Record<string, unknown> = { ...data };
  delete patch.createdAt;
  await ref.set(patch, { merge: true });
  const merged = { ...prev.data(), ...patch };
  return docToQuestion(id, merged as FirebaseFirestore.DocumentData);
}

/** 다량 생성 (UPLOAD) — 이미지 data URL은 Storage로 업로드 후 URL 저장 */
export async function createQuestions(questions: NewQuestion[]): Promise<number> {
  let created = 0;
  for (const q of questions) {
    const ref = db.collection(COL.questions).doc();
    const data = await buildQuestionDoc(ref.id, q, "UPLOAD");
    await ref.set(data);
    created++;
  }
  return created;
}

export async function deleteQuestion(id: string): Promise<void> {
  const ref = db.collection(COL.questions).doc(id);
  const s = await ref.get();
  if (s.exists) {
    await deleteImageByUrl(s.data()?.imageUrl);
    // 그림 선지 이미지도 정리 (Storage 고아 파일 방지)
    const choices: { imageUrl?: string | null }[] = Array.isArray(s.data()?.choices)
      ? s.data()!.choices
      : [];
    for (const c of choices) if (c.imageUrl) await deleteImageByUrl(c.imageUrl);
  }
  await ref.delete();
}

export async function countQuestions(): Promise<{ total: number; simhwa: number; gibon: number }> {
  const rows = await getAllQuestions();
  let simhwa = 0;
  let gibon = 0;
  for (const r of rows) r.level === "SIMHWA" ? simhwa++ : gibon++;
  return { total: rows.length, simhwa, gibon };
}

export async function getRounds(): Promise<number[]> {
  const rows = await getAllQuestions();
  const set = new Set<number>();
  for (const r of rows) if (r.examRound != null) set.add(r.examRound);
  return [...set].sort((a, b) => b - a);
}

export async function latestRound(): Promise<number | null> {
  const rounds = await getRounds();
  return rounds.length ? rounds[0] : null;
}

/** 문항의 factIds 갱신 (AI 연결용) */
export async function setQuestionFactIds(id: string, factIds: string[]): Promise<void> {
  await db.collection(COL.questions).doc(id).update({ factIds });
}

/** 연결 대상 문항 조회. missing=factIds 비어있는 것만, all=전체 */
export async function getQuestionsForLinking(
  mode: "missing" | "all"
): Promise<QuestionDTO[]> {
  const rows = await getAllQuestions();
  return mode === "all" ? rows : rows.filter((r) => r.factIds.length === 0);
}

// ───────────────────────── Release ─────────────────────────

export interface ReleaseDTO {
  id: string;
  version: number;
  title: string;
  notes: string;
  examRound: number | null;
  examLevel: string | null;
  questionCount: number;
  addedCount: number;
  publishedAt: string;
}

function docToRelease(id: string, d: FirebaseFirestore.DocumentData): ReleaseDTO {
  return {
    id,
    version: d.version,
    title: d.title,
    notes: d.notes ?? "",
    examRound: d.examRound ?? null,
    examLevel: d.examLevel ?? null,
    questionCount: d.questionCount ?? 0,
    addedCount: d.addedCount ?? 0,
    publishedAt: (d.publishedAt as Timestamp)?.toDate?.().toISOString() ?? new Date().toISOString(),
  };
}

export async function getReleases(): Promise<ReleaseDTO[]> {
  const snap = await db.collection(COL.releases).get();
  return snap.docs
    .map((d) => docToRelease(d.id, d.data()))
    .sort((a, b) => b.version - a.version);
}

export interface NewRelease {
  title: string;
  notes?: string;
  examRound?: number | null;
  examLevel?: string | null;
  addedCount?: number;
}

export async function createRelease(input: NewRelease): Promise<ReleaseDTO> {
  const releases = await getReleases();
  const version = (releases[0]?.version ?? 0) + 1;
  const { total } = await countQuestions();
  const ref = db.collection(COL.releases).doc();
  const data = {
    version,
    title: input.title.trim(),
    notes: input.notes ? String(input.notes) : "",
    examRound: input.examRound ?? null,
    examLevel: input.examLevel ?? null,
    questionCount: total,
    addedCount: input.addedCount ? Number(input.addedCount) : 0,
    publishedAt: Timestamp.now(),
  };
  await ref.set(data);
  return docToRelease(ref.id, data);
}

// ───────────────────────── Fact ─────────────────────────

function docToFact(id: string, d: FirebaseFirestore.DocumentData): FactDTO {
  return {
    id,
    era: d.era,
    year: d.year ?? null,
    title: d.title,
    kind: d.kind ?? "event",
    body: d.body ?? "",
    relatedTo: Array.isArray(d.relatedTo) ? d.relatedTo : [],
    period: d.period ?? null,
    category: d.category ?? null,
    importance: typeof d.importance === "number" ? d.importance : null,
    keywords: Array.isArray(d.keywords) ? d.keywords : [],
    prevFactIds: Array.isArray(d.prevFactIds) ? d.prevFactIds : [],
    nextFactIds: Array.isArray(d.nextFactIds) ? d.nextFactIds : [],
    detail: Array.isArray(d.detail) ? d.detail : [],
  };
}

export async function getFacts(era?: string | null, kind?: string | null): Promise<FactDTO[]> {
  const [factSnap, allQ] = await Promise.all([
    db.collection(COL.facts).get(),
    getAllQuestions(),
  ]);
  const counts = new Map<string, number>();
  for (const q of allQ) for (const fid of q.factIds) counts.set(fid, (counts.get(fid) ?? 0) + 1);

  let rows = factSnap.docs.map((d) => {
    const f = docToFact(d.id, d.data());
    return { ...f, questionCount: counts.get(f.id) ?? 0 };
  });
  if (era) rows = rows.filter((r) => r.era === era);
  if (kind) rows = rows.filter((r) => r.kind === kind);
  return rows.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

/** 튜터 RAG: 키워드(2자+)로 title 포함 검색, 최대 5건 */
export async function searchFacts(terms: string[], take = 5): Promise<FactDTO[]> {
  if (terms.length === 0) return [];
  const snap = await db.collection(COL.facts).get();
  const rows = snap.docs.map((d) => docToFact(d.id, d.data()));
  return rows.filter((f) => terms.some((t) => f.title.includes(t))).slice(0, take);
}

/** 연표 항목의 이전/이후 방향 관계 갱신 (AI 관계망 생성용) */
export async function setFactRelations(
  id: string,
  prevFactIds: string[],
  nextFactIds: string[]
): Promise<void> {
  await db.collection(COL.facts).doc(id).update({ prevFactIds, nextFactIds });
}

/** 연표 항목의 상세 설명(단문 배열) 갱신 (AI 생성용) */
export async function setFactDetail(id: string, detail: string[]): Promise<void> {
  await db.collection(COL.facts).doc(id).update({ detail });
}

// ───────────────────────── Video ─────────────────────────

function docToVideo(id: string, d: FirebaseFirestore.DocumentData): VideoDTO {
  return {
    id,
    youtubeId: d.youtubeId,
    url: d.url,
    title: d.title,
    channel: d.channel ?? null,
    thumbnailUrl: d.thumbnailUrl ?? null,
    publishedAt: (d.publishedAt as Timestamp)?.toDate?.().toISOString() ?? new Date().toISOString(),
    aiAnalysis: d.aiAnalysis ?? "",
    summary: d.summary ?? "",
  };
}

export async function getVideos(): Promise<VideoDTO[]> {
  const snap = await db.collection(COL.videos).get();
  return snap.docs
    .map((d) => docToVideo(d.id, d.data()))
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export interface NewVideo {
  youtubeId: string;
  url: string;
  title: string;
  channel?: string | null;
  thumbnailUrl?: string | null;
  publishedAt: Date;
  aiAnalysis?: string;
  summary?: string;
}

export async function createVideo(v: NewVideo): Promise<VideoDTO> {
  const ref = db.collection(COL.videos).doc();
  const data = {
    youtubeId: v.youtubeId,
    url: v.url,
    title: v.title,
    channel: v.channel ?? null,
    thumbnailUrl: v.thumbnailUrl ?? null,
    publishedAt: Timestamp.fromDate(v.publishedAt),
    aiAnalysis: v.aiAnalysis ?? "",
    summary: v.summary ?? "",
    createdAt: Timestamp.now(),
  };
  await ref.set(data);
  return docToVideo(ref.id, data);
}

export async function deleteVideo(id: string): Promise<void> {
  await db.collection(COL.videos).doc(id).delete();
}
