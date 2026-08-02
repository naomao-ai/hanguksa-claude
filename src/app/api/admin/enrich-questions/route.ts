import { NextRequest, NextResponse } from "next/server";
import { enrichAllQuestions } from "@/lib/ai/enrich-questions";

// POST /api/admin/enrich-questions { mode?: "missing" | "all" }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const mode = body.mode === "all" ? "all" : "missing";

    // Vercel Serverless Function 타임아웃 방지를 위해
    // 실제로는 백그라운드 워커를 사용하는 것이 좋으나,
    // 현재 아키텍처상 await로 대기 (로컬 또는 커스텀 타임아웃 환경 가정)
    const result = await enrichAllQuestions(mode);

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
