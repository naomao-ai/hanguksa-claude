import crypto from "crypto";
import type { NextRequest } from "next/server";

/**
 * 계정 시스템 없이 단일 관리자 인증.
 * ADMIN_PASSWORD(.env.local)로 로그인 → httpOnly 쿠키에 파생 토큰 저장.
 * 쓰기 API(업로드/생성/삭제/릴리스 발행)는 isAdmin() 통과 시에만 허용.
 */

export const ADMIN_COOKIE = "hk_admin";

export function adminConfigured(): boolean {
  return (process.env.ADMIN_PASSWORD || "").length > 0;
}

/** 비밀번호로부터 결정적 세션 토큰 파생 */
export function adminToken(): string {
  const pw = process.env.ADMIN_PASSWORD || "";
  const salt = process.env.ADMIN_SECRET || "hanguksa-admin-salt";
  return crypto.createHash("sha256").update(`${salt}:${pw}`).digest("hex");
}

export function checkPassword(pw: string): boolean {
  const expected = process.env.ADMIN_PASSWORD || "";
  if (!expected) return false;
  // 타이밍 안전 비교
  const a = Buffer.from(pw);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function isAdmin(req: NextRequest): boolean {
  if (!adminConfigured()) return false;
  const t = req.cookies.get(ADMIN_COOKIE)?.value;
  return !!t && t === adminToken();
}
