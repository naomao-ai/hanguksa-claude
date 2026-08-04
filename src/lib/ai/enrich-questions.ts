import Anthropic from "@anthropic-ai/sdk";
import { getAllQuestions, setQuestionWikiMeta } from "@/lib/firestore";
import type { QuestionDTO } from "@/lib/types";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 미설정");
    _client = new Anthropic();
  }
  return _client;
}

const ENRICH_TOOL = {
  name: "enrich_question",
  description: "한국사 문항의 Wiki용 메타데이터(역사적 맥락, 오답 함정, 학습 팁, 연관 개념)를 생성한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      wikiMeta: {
        type: "object",
        properties: {
          historicalContext: { type: "string", description: "이 문제가 다루는 역사적 맥락 (배경 → 전개 → 결과, 2~3문장)" },
          commonMistakes: { type: "string", description: "수험생이 자주 틀리는 오답 함정과 헷갈리기 쉬운 구분 포인트 (1~2문장)" },
          studyTip: { type: "string", description: "이 주제를 효과적으로 학습하고 암기하는 팁 (1~2문장)" },
          relatedConcepts: { type: "array", items: { type: "string" }, description: "이 문항과 연관된 더 넓은 범위의 개념 키워드 3~5개" },
        },
        required: ["historicalContext", "commonMistakes", "studyTip", "relatedConcepts"],
      },
    },
    required: ["wikiMeta"],
  },
};

const ENRICH_SYSTEM = `당신은 한국사능력검정시험(한능검) 전문 강사이자 위키 작성자입니다.
주어진 기출문제를 분석하여 수험생에게 실질적인 도움이 되는 위키용 심층 해설 데이터를 생성합니다.
- historicalContext: 단순 해설이 아니라, 이 사건/인물/제도가 왜 등장했는지(배경), 어떻게 전개되었는지, 어떤 결과를 낳았는지 흐름을 2~3문장으로 설명합니다.
- commonMistakes: 오답 선지가 왜 매력적인지, 어떤 다른 사건과 헷갈리기 쉬운지 짚어줍니다.
- studyTip: 암기 팁, 두음자, 시대적 흐름 파악법 등을 제안합니다.
- relatedConcepts: 문제의 직접적 정답 외에도 함께 알아두면 좋은 연관 개념 키워드를 추출합니다.
- 반드시 enrich_question 도구를 호출하여 반환합니다.`;

/** 단일 문항의 위키 메타데이터 생성 */
export async function enrichQuestion(question: QuestionDTO): Promise<QuestionDTO["wikiMeta"]> {
  const userText = 
    `[문제]\n발문: ${question.stem}\n` +
    (question.passage ? `자료: ${question.passage}\n` : "") +
    (question.imageDescription ? `시각자료: ${question.imageDescription}\n` : "") +
    `선지:\n${question.choices.map(c => `  ${c.order}. ${c.text}`).join("\n")}\n` +
    `정답 인덱스: ${question.answerIndex}\n` +
    (question.explanation ? `해설: ${question.explanation}\n` : "") +
    (question.corePoint ? `AI핵심요약: ${question.corePoint.summary}\n` : "") +
    `주제태그: ${question.topics.join(", ")}\n시대: ${question.era}\n` +
    `\n위 문제를 분석하여 위키에 들어갈 enrich_question 데이터를 생성하세요.`;

  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 600,
      system: ENRICH_SYSTEM,
      tools: [ENRICH_TOOL],
      tool_choice: { type: "tool", name: "enrich_question" },
      messages: [{ role: "user", content: userText }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    const input = block && block.type === "tool_use" ? (block.input as { wikiMeta?: QuestionDTO["wikiMeta"] }) : {};
    return input.wikiMeta || null;
  } catch (err) {
    console.error(`Error enriching question ${question.id}:`, err);
    return null;
  }
}

/** 일괄 생성: missing=wikiMeta 비어있는 항목만, all=전체. 순차 처리. */
export async function enrichAllQuestions(
  mode: "missing" | "all"
): Promise<{ processed: number; enriched: number }> {
  const allQ = await getAllQuestions();
  const targets = allQ.filter((q) => mode === "all" || !q.wikiMeta);
  
  let enriched = 0;
  for (const q of targets) {
    const meta = await enrichQuestion(q);
    if (meta) {
      await setQuestionWikiMeta(q.id, meta);
      enriched++;
    }
  }
  return { processed: targets.length, enriched };
}
