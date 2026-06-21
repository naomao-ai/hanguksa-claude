import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { cachedJson } from "@/lib/http";
import { extractYoutubeId, thumbnailUrl } from "@/lib/youtube";
import { summarizeVideoAnalysis } from "@/lib/ai/claude";
import { getVideos, createVideo } from "@/lib/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/videos — 공개: 영상 목록 (게시일 최신순)
export async function GET() {
  const videos = await getVideos();
  return cachedJson({ videos }, 30);
}

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

async function fetchOEmbed(url: string): Promise<OEmbed | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    return (await res.json()) as OEmbed;
  } catch {
    return null;
  }
}

// POST /api/videos — 관리자: 영상 등록
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const { url, publishedAt, aiAnalysis, title: manualTitle } = body as {
    url?: string;
    publishedAt?: string;
    aiAnalysis?: string;
    title?: string;
  };

  const youtubeId = extractYoutubeId(url || "");
  if (!youtubeId) {
    return NextResponse.json({ error: "유효한 YouTube URL이 아닙니다." }, { status: 400 });
  }

  const watch = `https://www.youtube.com/watch?v=${youtubeId}`;
  const oembed = await fetchOEmbed(watch);
  const title = (manualTitle?.trim() || oembed?.title || "").trim();
  if (!title) {
    return NextResponse.json(
      { error: "제목을 불러오지 못했습니다. 제목을 직접 입력하세요." },
      { status: 422 }
    );
  }

  // 게시일: 입력값 우선, 없으면 오늘
  const date = publishedAt ? new Date(publishedAt) : new Date();
  if (isNaN(date.getTime())) {
    return NextResponse.json({ error: "게시일 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const summary = await summarizeVideoAnalysis(aiAnalysis || "", title);

  const video = await createVideo({
    youtubeId,
    url: watch,
    title,
    channel: oembed?.author_name ?? null,
    thumbnailUrl: oembed?.thumbnail_url ?? thumbnailUrl(youtubeId),
    publishedAt: date,
    aiAnalysis: aiAnalysis ? String(aiAnalysis) : "",
    summary,
  });

  return NextResponse.json({ video });
}
