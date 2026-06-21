import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { deleteVideo } from "@/lib/firestore";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const { id } = await ctx.params;
  await deleteVideo(id);
  return NextResponse.json({ ok: true });
}
