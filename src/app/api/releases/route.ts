import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { cachedJson } from "@/lib/http";
import { getReleases, countQuestions, latestRound, createRelease } from "@/lib/firestore";

export const dynamic = "force-dynamic";

// GET /api/releases — 공개: 변경이력 + 현재 데이터셋 메타
export async function GET() {
  const [releases, counts, round] = await Promise.all([
    getReleases(),
    countQuestions(),
    latestRound(),
  ]);

  const current = releases[0] ?? null;
  return cachedJson({
    current: current
      ? { version: current.version, title: current.title, publishedAt: current.publishedAt }
      : null,
    meta: {
      total: counts.total,
      simhwa: counts.simhwa,
      gibon: counts.gibon,
      latestRound: round,
      updatedAt: current?.publishedAt ?? null,
    },
    releases,
  }, 30);
}

// POST /api/releases — 관리자: 새 릴리스(업데이트) 발행
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { title, notes, examRound, examLevel, addedCount } = body;
  if (!title || String(title).trim().length === 0) {
    return NextResponse.json({ error: "제목을 입력하세요." }, { status: 400 });
  }

  const release = await createRelease({
    title: String(title).trim(),
    notes: notes ? String(notes) : "",
    examRound: examRound ? Number(examRound) : null,
    examLevel: examLevel || null,
    addedCount: addedCount ? Number(addedCount) : 0,
  });

  return NextResponse.json({ release });
}
