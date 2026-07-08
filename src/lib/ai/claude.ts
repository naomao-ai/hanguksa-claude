import Anthropic from "@anthropic-ai/sdk";
import { ANALYZE_TOOL_SCHEMA, AnalyzeResultSchema, type AnalyzeResult } from "./schema";

// 모델: 기본 Opus 4.8 (환경변수로 재정의 가능)
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local 에 키를 추가하세요."
      );
    }
    _client = new Anthropic();
  }
  return _client;
}

export type ImageRole = "question" | "answer";

export interface ImageInput {
  media_type: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  /** base64 (data URL 접두사 제외) */
  data: string;
  /** 이미지 역할: question=문제지, answer=답안지. 미지정 시 문제지로 간주 */
  role?: ImageRole;
}

const ANALYZE_SYSTEM = `당신은 한국사능력검정시험(한능검) 기출문제 분석 전문가입니다.
업로드된 시험지 이미지에서 각 문항을 정확히 추출하여 구조화합니다.

[이미지 역할]
- [문제지] 라벨이 붙은 이미지에서 문항(발문·자료·선지)을 추출합니다.
- [답안지] 라벨이 붙은 이미지는 정답표입니다. 문항 번호별 정답을 읽어 각 문항의 answerIndex에 정확히 매핑합니다.
- 답안지가 제공되면 그 정답을 최우선으로 사용하고 answerSource를 "답지"로 설정합니다.
- 답안지가 없거나 해당 문항 정답이 답지에 없으면 한국사 지식으로 추정하고 answerSource를 "추정"으로 설정합니다.
- 답안지의 정답 번호(1~5번, ①②③④⑤)는 1-base이므로 answerIndex(0-base)로 변환할 때 1을 빼야 합니다(예: 정답 3번 → answerIndex 2).

[머리글·문항 영역]
- 페이지 상단 머리글(예: "제78회 한국사능력검정시험 (심화)")이 보이면 examRound(78)와 level(심화=SIMHWA, 기본=GIBON)을 채웁니다.
- 각 문항마다 questionBox(문항 번호부터 마지막 선지 끝까지를 감싸는 0~1 경계상자)를 반드시 채웁니다. 시험지가 2단(좌/우 컬럼) 구성이면 그 문항이 속한 단 안으로만 잡습니다. 그 문항의 imageBox·choiceImages 상자는 모두 questionBox 안에 있어야 합니다.

[그림·시각 자료 처리]
- 문항에 그림·지도·사진·유물·도표·삽화 등 시각 자료가 있으면 imageDescription에 그 내용을 한국사 지식으로 구체적으로 묘사합니다(예: "고려청자 상감운학문 매병 사진", "대동여지도의 일부 지도", "5·18 민주화운동 당시 사진").
- 단순 텍스트 사료는 passage에, 시각 자료는 imageDescription에 구분해 넣습니다.
- 삽화·만화·포스터 속 말풍선/라벨/판서/현수막의 텍스트는 풀이의 핵심 단서입니다. 요약하지 말고 imageDescription에 원문 그대로 전사합니다(예: 삽화 묘사 + 말풍선: "5도와 양계를 두어 지방을 통치하였습니다").
- 두루마리·편지지·족자·비석 등 장식 배경 위에 쓰인 텍스트 자료는 시각 자료가 아니라 사료입니다. 반드시 원문을 passage에 그대로 추출합니다(그림 크롭·imageDescription은 보조).
- 시각 자료가 핵심 단서인 문항은 묘사를 빠뜨리면 문제를 풀 수 없으므로 반드시 묘사합니다.
- 시각 자료가 있는 문항은 imageSourceIndex(그림이 있는 이미지의 N)와 imageBox(그림 영역의 정규화 경계상자 0~1)도 채웁니다. 각 이미지 앞 '[이미지 N: 역할]' 라벨의 N을 그대로 사용하고, 경계상자는 그림만 타이트하게 감싸되 발문·선지 텍스트는 제외합니다. 시각 자료가 없으면 imageSourceIndex·imageBox는 null로 둡니다.
- 한능검 문항의 일반적 배치는 [발문(질문) + 배점([n점])] → [그림/자료] → [선지(①②③④⑤)] 순서입니다. 그림의 세로 범위는 다음 두 랜드마크로 정확히 결정합니다:
  · scoreMarkerY = 배점 표시([2점]·[3점] 등)가 있는 줄의 바로 아래 세로 위치(0~1). 그림은 정확히 여기서 시작합니다.
  · choicesTopY = 보기 ①(숫자 1번 선지)가 시작되는 바로 위 세로 위치(0~1). 그림은 정확히 여기서 끝납니다.
  시각 자료가 있는 문항은 이 두 값을 0~1로 정밀하게 측정해 채웁니다. 이 두 랜드마크가 그림의 세로 범위를 결정하며 imageBox.y/height보다 우선합니다.

[선지가 그림인 경우 — ①②③④⑤가 사진·지도·유물·탑 등]
- 선지가 그림이면 choiceKind를 "image"로 설정합니다(글자 선지면 "text", choiceImages는 null).
- choices에는 각 선지 그림을 한국사 지식으로 식별한 짧은 라벨을 순서대로 넣습니다(예: ["월정사 8각 9층 석탑","경천사지 10층 석탑","정림사지 5층 석탑",...]). 식별이 어려우면 "선지 1 그림"처럼이라도 반드시 채웁니다.
- choiceImages에는 choices와 같은 순서·개수로 각 선지 그림의 imageBox(0~1 정규화 경계상자), marker(①~⑤), imageSourceIndex(그림이 있는 이미지 N)를 채웁니다. 각 상자는 그 선지 그림 하나만 타이트하게 감싸고 선지 번호·여백은 제외합니다.
- 선지 그림은 보통 ①②③④⑤ 마커 아래에 격자(한 줄 5개 또는 여러 줄)로 배치됩니다. 각 그림의 경계를 인접 마커 위치를 기준으로 정확히 구분합니다.
- 정답은 그림 선지에서도 번호로 결정하므로, 답안지가 있으면 그 번호를 answerIndex로 매핑합니다.

[추출 규칙]
- 발문(stem), 사료/자료 지문(passage), 선지(choices)를 원문 그대로 추출합니다.
- era는 반드시 주어진 시대 키 중 하나로 분류합니다.
- topics에는 핵심 인물/사건/제도 키워드를 넣습니다(예: ["광종","과거제","노비안검법"]).
- 해설이 있으면 explanation에, 없으면 핵심 근거를 간략히 작성합니다.
- 자료(사료/사진/지도)가 제시된 문항은 qType을 "자료제시형"으로 분류합니다.
- 반드시 extract_questions 도구를 호출하여 결과를 반환합니다.`;

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  /** 분석에 사용된 모델 (비용 가늠용) */
  model: string;
}

export interface AnalyzeResultWithUsage {
  result: AnalyzeResult;
  usage: TokenUsage;
}

/**
 * 업로드된 이미지(들)를 Claude Vision으로 분석해 문항 배열로 변환한다.
 */
export async function analyzeQuestionImages(
  images: ImageInput[],
  hint?: string,
  model?: string
): Promise<AnalyzeResultWithUsage> {
  // UI 선택값 > 환경변수(CLAUDE_MODEL) > 기본 Opus 4.8
  const useModel = model || MODEL;
  // 각 이미지 앞에 역할 라벨([문제지]/[답안지]) 텍스트 블록을 삽입해
  // 모델이 문제지와 답안지를 구분하도록 한다.
  const content: Anthropic.ContentBlockParam[] = [];
  images.forEach((img, idx) => {
    const label = img.role === "answer" ? "답안지" : "문제지";
    // 0-base 인덱스를 라벨에 노출해 imageSourceIndex 매핑에 사용
    content.push({ type: "text", text: `[이미지 ${idx}: ${label}]` });
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.media_type, data: img.data },
    });
  });

  const hasAnswerSheet = images.some((i) => i.role === "answer");
  content.push({
    type: "text",
    text:
      (hint ? `참고: ${hint}\n\n` : "") +
      (hasAnswerSheet
        ? "위 [문제지]에서 모든 문항을 추출하고, [답안지]의 정답표를 읽어 각 문항의 정답(answerIndex)을 매핑하세요. "
        : "위 이미지의 모든 문항을 추출하세요. 답안지가 없으므로 정답은 한국사 지식으로 추정하세요. ") +
      "그림·지도·사진 등 시각 자료가 있으면 imageDescription에 묘사하고, 선지가 그림(사진·유물·탑 등)이면 choiceKind='image'와 choiceImages(각 선지 그림 위치)를 채워 extract_questions 도구로 반환하세요.",
  });

  const response = await client().messages.create({
    model: useModel,
    max_tokens: 16000,
    system: ANALYZE_SYSTEM,
    tools: [
      {
        name: "extract_questions",
        description: "추출한 한능검 문항들을 구조화하여 반환",
        input_schema: ANALYZE_TOOL_SCHEMA as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "extract_questions" },
    messages: [{ role: "user", content }],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI가 문항을 추출하지 못했습니다.");
  }

  const result = AnalyzeResultSchema.parse(toolUse.input);
  const usage: TokenUsage = {
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens,
    total_tokens: response.usage.input_tokens + response.usage.output_tokens,
    model: useModel,
  };

  return { result, usage };
}

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

const TUTOR_SYSTEM = `당신은 한국사능력검정시험 대비를 돕는 친절한 한국사 튜터입니다.
- 수검자의 질문에 정확하고 이해하기 쉽게 답합니다.
- 제공된 [참고 자료]가 있으면 그 근거를 우선 활용하되, 부족하면 일반 한국사 지식으로 보완합니다.
- 시대 흐름과 인과관계를 짚어 암기가 아닌 이해를 돕습니다.
- 답변은 핵심부터 간결하게, 필요한 경우 예시를 듭니다.`;

/**
 * AI 튜터 응답을 스트리밍한다. (문제은행/해설을 근거로 한 RAG)
 */
export async function tutorStream(
  messages: TutorMessage[],
  context?: string
): Promise<ReadableStream<Uint8Array>> {
  const sys = context
    ? `${TUTOR_SYSTEM}\n\n[참고 자료]\n${context}`
    : TUTOR_SYSTEM;

  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 2048,
    system: sys,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        stream.on("text", (delta) => controller.enqueue(encoder.encode(delta)));
        await stream.finalMessage();
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}

const VIDEO_SUMMARY_SYSTEM = `당신은 한국사 학습 영상의 핵심을 간결히 정리하는 도우미입니다.
사용자가 붙여넣은 '영상 AI 분석 결과'를 학습자가 카드에서 한눈에 볼 수 있도록 1~3문장(최대 약 120자)의 한국어 요약으로 압축합니다.
- 영상에서 다루는 핵심 시대·인물·사건·개념을 중심으로 정리합니다.
- 군더더기(인사말, "이 영상은~" 같은 상투구)는 제거하고 정보 밀도를 높입니다.
- 머리말·따옴표 없이 요약 문장만 출력합니다.`;

/**
 * 관리자가 붙여넣은 유튜브 AI 분석 결과를 카드용 간략 요약으로 압축한다.
 * 키가 없거나 실패하면 원문 앞부분으로 폴백한다.
 */
export async function summarizeVideoAnalysis(
  rawText: string,
  title?: string
): Promise<string> {
  const text = (rawText || "").trim();
  if (!text) return "";
  const fallback = () => (text.length > 160 ? text.slice(0, 157) + "…" : text);
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 300,
      system: VIDEO_SUMMARY_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            (title ? `[영상 제목] ${title}\n\n` : "") +
            `[영상 AI 분석 결과]\n${text}\n\n위 분석을 카드용 1~3문장 요약으로 정리하세요.`,
        },
      ],
    });
    const out = res.content.find((b) => b.type === "text");
    const summary = out && out.type === "text" ? out.text.trim() : "";
    return summary || fallback();
  } catch {
    return fallback();
  }
}
