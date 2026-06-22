import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { linkAllQuestions } from "@/lib/ai/link-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/link-facts { mode?: "missing" | "all" }
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "all" ? "all" : "missing";
  try {
    const result = await linkAllQuestions(mode);
    return NextResponse.json(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const status = /ANTHROPIC_API_KEY/.test(raw) ? 503 : 500;
    return NextResponse.json({ error: "연결 처리 중 오류: " + raw }, { status });
  }
}
