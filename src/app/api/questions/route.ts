import { NextRequest, NextResponse } from "next/server";
import { ERA_KEYS } from "@/lib/domain";
import { isAdmin } from "@/lib/admin";
import { getQuestions, getQuestionsByIds, createQuestion } from "@/lib/firestore";

export const dynamic = "force-dynamic";

// GET /api/questions?level=&era=&qType=&topic=&round=&limit=&random=&ids=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const idsParam = sp.get("ids")?.trim();

  // ids 일괄 조회 (복습/북마크) — 입력 순서 보존
  if (idsParam) {
    const ids = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 500);
    return NextResponse.json({ questions: await getQuestionsByIds(ids) });
  }

  const level = sp.get("level") || undefined;
  const era = sp.get("era") || undefined;
  const qType = sp.get("qType") || undefined;
  const topic = sp.get("topic") || undefined;
  const round = sp.get("round");
  const q = sp.get("q")?.trim() || undefined;
  const random = sp.get("random") === "1";
  const limit = Math.min(parseInt(sp.get("limit") || "100", 10), 500);

  const questions = await getQuestions({
    level,
    era: era && ERA_KEYS.includes(era) ? era : undefined,
    qType,
    topic,
    round: round ? parseInt(round, 10) : undefined,
    q,
    random,
    limit,
  });

  return NextResponse.json({ questions });
}

// POST /api/questions — 단일 문항 수동 생성 (관리자)
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json();
  const { stem, choices, era } = body;
  if (!stem || !Array.isArray(choices) || choices.length < 2) {
    return NextResponse.json(
      { error: "발문과 2개 이상의 선지가 필요합니다." },
      { status: 400 }
    );
  }

  const question = await createQuestion({
    level: body.level === "GIBON" ? "GIBON" : "SIMHWA",
    stem,
    passage: body.passage || null,
    imageDescription: body.imageDescription || null,
    choices: choices as string[],
    answerIndex: Number(body.answerIndex) || 0,
    explanation: body.explanation || null,
    era: ERA_KEYS.includes(era) ? era : "joseon",
    topics: Array.isArray(body.topics) ? body.topics : [],
    qType: body.qType || "기타",
    difficulty: body.difficulty ? Number(body.difficulty) : null,
    examRound: body.examRound ? Number(body.examRound) : null,
    examYear: body.examYear ? Number(body.examYear) : null,
    number: body.number ? Number(body.number) : null,
  });

  return NextResponse.json({ question });
}
