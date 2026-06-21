import { NextRequest, NextResponse } from "next/server";
import { analyzeQuestionImages, type ImageInput } from "@/lib/ai/claude";
import { isAdmin } from "@/lib/admin";
import { isValidModel } from "@/lib/models";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// POST /api/analyze  { images: [{media_type, data(base64)}], hint? }
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  try {
    const { images, hint, model } = (await req.json()) as {
      images: ImageInput[];
      hint?: string;
      model?: string;
    };

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "이미지를 한 장 이상 업로드하세요." },
        { status: 400 }
      );
    }
    if (images.length > 20) {
      return NextResponse.json(
        { error: "한 번에 최대 20장까지 분석할 수 있습니다. (PDF는 페이지 범위를 나눠 분석하세요)" },
        { status: 400 }
      );
    }
    // Claude Vision이 허용하는 이미지 형식만 통과 (PDF 등은 페이지 이미지로 변환해 보내야 함)
    const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    const bad = images.find((i) => !ALLOWED.includes(i.media_type));
    if (bad) {
      return NextResponse.json(
        { error: `지원하지 않는 형식(${bad.media_type})입니다. PNG·JPG·WEBP·GIF 또는 PDF(페이지 변환)만 가능합니다.` },
        { status: 400 }
      );
    }

    // 모델은 화이트리스트에 있을 때만 채택 (없으면 서버 기본값 사용)
    const chosenModel = isValidModel(model) ? model : undefined;
    const { result, usage } = await analyzeQuestionImages(images, hint, chosenModel);
    return NextResponse.json({ ...result, usage });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    let msg = "분석 중 오류가 발생했습니다.";
    let status = 500;
    if (/credit balance is too low/i.test(raw)) {
      msg = "Claude 크레딧 잔액이 부족합니다. platform.claude.com → Plans & Billing에서 충전 후 다시 시도하세요.";
      status = 402;
    } else if (/ANTHROPIC_API_KEY/i.test(raw)) {
      msg = "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local에 키를 추가하세요.";
      status = 503;
    } else if (/rate.?limit|429/i.test(raw)) {
      msg = "요청이 많아 잠시 후 다시 시도하세요. (rate limit)";
      status = 429;
    } else if (/\b401\b|authentication/i.test(raw)) {
      msg = "Claude API 키가 올바르지 않습니다. 키를 확인하세요.";
      status = 401;
    }
    return NextResponse.json({ error: msg }, { status });
  }
}
