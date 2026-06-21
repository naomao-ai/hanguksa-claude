import { NextRequest, NextResponse } from "next/server";
import { ERA_KEYS } from "@/lib/domain";
import { AnalyzeResultSchema } from "@/lib/ai/schema";
import { isAdmin } from "@/lib/admin";
import { createQuestions, type NewQuestion } from "@/lib/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/questions/bulk — 분석/편집된 문항 묶음 저장 (관리자)
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json();
  const parsed = AnalyzeResultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "문항 데이터 형식이 올바르지 않습니다.", detail: parsed.error.issues },
      { status: 400 }
    );
  }

  const { level, examRound, examYear, questions } = parsed.data;
  const defLevel = level === "GIBON" ? "GIBON" : "SIMHWA";

  const items: NewQuestion[] = questions.map((q) => ({
    level: defLevel,
    examRound: examRound ?? null,
    examYear: examYear ?? null,
    number: q.number ?? null,
    stem: q.stem,
    passage: q.passage ?? null,
    imageDescription: q.imageDescription ?? null,
    imageUrl: q.imageUrl ?? null,
    answerIndex: q.answerIndex,
    explanation: q.explanation ?? null,
    era: ERA_KEYS.includes(q.era) ? q.era : "joseon",
    topics: q.topics ?? [],
    qType: q.qType || "기타",
    difficulty: q.difficulty ?? null,
    choices: q.choices,
    source: "UPLOAD",
  }));

  const created = await createQuestions(items);
  return NextResponse.json({ created });
}
