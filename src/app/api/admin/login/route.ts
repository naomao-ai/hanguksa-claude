import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, adminConfigured, adminToken, checkPassword } from "@/lib/admin";

export const dynamic = "force-dynamic";

// POST /api/admin/login { password }
export async function POST(req: NextRequest) {
  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD가 설정되지 않았습니다. .env.local 에 추가하세요." },
      { status: 503 }
    );
  }
  const { password } = await req.json().catch(() => ({}));
  if (!checkPassword(password || "")) {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
  }
  // HTTPS일 때만 secure 쿠키 사용 (사내망 HTTP 배포에서도 로그인 유지)
  const isHttps =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto") === "https";
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12시간
    secure: isHttps,
  });
  return res;
}

// DELETE /api/admin/login — 로그아웃
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
