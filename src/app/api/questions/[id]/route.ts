import { NextRequest, NextResponse } from "next/server";
import { ERA_KEYS } from "@/lib/domain";
import { isAdmin } from "@/lib/admin";
import { getQuestionById, deleteQuestion, updateQuestion, type NewQuestion } from "@/lib/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const question = await getQuestionById(id);
  if (!question) return NextResponse.json({ error: "문항을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ question });
}

// PATCH /api/questions/[id] — 문항 수정 (관리자). 선지 텍스트/이미지 포함 전체 갱신.
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { stem, choices } = body;
  if (!stem || !Array.isArray(choices) || choices.length < 2) {
    return NextResponse.json({ error: "발문과 2개 이상의 선지가 필요합니다." }, { status: 400 });
  }
  const payload: NewQuestion = {
    level: body.level === "GIBON" ? "GIBON" : "SIMHWA",
    stem,
    passage: body.passage || null,
    imageUrl: body.imageUrl ?? null,
    imageDescription: body.imageDescription || null,
    choices, // string[] 또는 {text,imageUrl}[]
    answerIndex: Number(body.answerIndex) || 0,
    explanation: body.explanation || null,
    era: ERA_KEYS.includes(body.era) ? body.era : "joseon",
    topics: Array.isArray(body.topics) ? body.topics : [],
    qType: body.qType || "기타",
    difficulty: body.difficulty ? Number(body.difficulty) : null,
    examRound: body.examRound ? Number(body.examRound) : null,
    examYear: body.examYear ? Number(body.examYear) : null,
    number: body.number ? Number(body.number) : null,
    factIds: Array.isArray(body.factIds) ? body.factIds : [],
  };
  const question = await updateQuestion(id, payload);
  if (!question) return NextResponse.json({ error: "문항을 찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ question });
}

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await ctx.params;
  await deleteQuestion(id);
  return NextResponse.json({ ok: true });
}
