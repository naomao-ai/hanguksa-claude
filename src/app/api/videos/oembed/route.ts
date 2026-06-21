import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { extractYoutubeId, thumbnailUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

// GET /api/videos/oembed?url=... — 관리자 폼 미리보기 (제목·썸네일·채널)
export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const url = req.nextUrl.searchParams.get("url") || "";
  const youtubeId = extractYoutubeId(url);
  if (!youtubeId) {
    return NextResponse.json({ error: "유효한 YouTube URL이 아닙니다." }, { status: 400 });
  }
  const watch = `https://www.youtube.com/watch?v=${youtubeId}`;
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error("oembed failed");
    const d = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
    return NextResponse.json({
      youtubeId,
      title: d.title ?? "",
      channel: d.author_name ?? "",
      thumbnailUrl: d.thumbnail_url ?? thumbnailUrl(youtubeId),
    });
  } catch {
    // oEmbed 실패(비공개·삭제 등) → 썸네일만 반환, 제목 수동 입력 유도
    return NextResponse.json({
      youtubeId,
      title: "",
      channel: "",
      thumbnailUrl: thumbnailUrl(youtubeId),
    });
  }
}
