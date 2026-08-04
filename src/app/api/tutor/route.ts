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
          .join(" / ")}\n정답: ${q.answerIndex + 1}번\n해설: ${q.explanation ?? "(없음)"}\n`;
          
        if (q.wikiMeta) {
          context += `관련 맥락: ${q.wikiMeta.historicalContext}\n`;
          if (q.wikiMeta.studyTip) context += `암기 팁: ${q.wikiMeta.studyTip}\n`;
          if (q.wikiMeta.commonMistakes) context += `오답 노트: ${q.wikiMeta.commonMistakes}\n`;
        }
        context += `\n`;
      }
    }

    // 불용어(조사 등) 간이 제거 후 2글자 이상 키워드 추출
    const terms = last.split(/[\s,.·?!]+/)
      .map(t => t.replace(/(은|는|이|가|을|를|의|에|로|으로|에서)+$/, ''))
      .filter((t) => t.length >= 2)
      .slice(0, 8);
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
