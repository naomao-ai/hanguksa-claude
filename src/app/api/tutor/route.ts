import { NextRequest, NextResponse } from "next/server";
import { tutorStream, type TutorMessage } from "@/lib/ai/claude";
import { getQuestionById, searchFacts } from "@/lib/firestore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/tutor  { messages: [{role, content}], questionId? }
export async function POST(req: NextRequest) {
  try {
    const { messages, questionId } = (await req.json()) as {
      messages: TutorMessage[];
      questionId?: string;
    };

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: "메시지가 비어 있습니다." }, { status: 400 });
    }

    // RAG: 최근 질문과 관련된 문항/사실을 근거로 첨부
    const last = messages[messages.length - 1]?.content ?? "";
    let context = "";

    if (questionId) {
      const q = await getQuestionById(questionId);
      if (q) {
        context += `[문항] ${q.stem}\n선지: ${q.choices
          .map((c, i) => `${i + 1}. ${c.text}`)
          .join(" / ")}\n정답: ${q.answerIndex + 1}번\n해설: ${q.explanation ?? "(없음)"}\n\n`;
      }
    }

    // 키워드 기반 관련 사실 검색
    const terms = last.split(/[\s,.·?!]+/).filter((t) => t.length >= 2).slice(0, 8);
    if (terms.length) {
      const facts = await searchFacts(terms, 5);
      for (const f of facts) {
        context += `[사실] ${f.title} (${f.year ?? "?"}): ${f.body}\n`;
      }
    }

    const stream = await tutorStream(messages, context || undefined);
    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "튜터 응답 중 오류가 발생했습니다.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
