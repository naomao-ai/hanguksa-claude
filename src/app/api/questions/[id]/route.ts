import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { getQuestionById, deleteQuestion } from "@/lib/firestore";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const question = await getQuestionById(id);
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
