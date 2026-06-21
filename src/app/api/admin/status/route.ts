import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, isAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// GET /api/admin/status — 현재 관리자 로그인 여부
export async function GET(req: NextRequest) {
  return NextResponse.json({ admin: isAdmin(req), configured: adminConfigured() });
}
