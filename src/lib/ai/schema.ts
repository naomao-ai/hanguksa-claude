import { z } from "zod";
import { ERA_KEYS, QUESTION_TYPES } from "@/lib/domain";

const qTypeKeys = QUESTION_TYPES.map((q) => q.key) as [string, ...string[]];

/** 정규화 경계상자 (0~1, 좌상단 원점) */
const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

/** 그림 선지: 짧은 라벨(text) + 크롭된 이미지(imageUrl, 클라이언트가 채움) */
const ChoiceObjSchema = z.object({
  text: z.string().default(""),
  imageUrl: z.string().nullable().optional(),
});

/** 그림 선지 하나의 위치 (choices와 같은 순서). 클라이언트 크롭용 */
const ChoiceFigureSchema = z.object({
  /** 선지 번호(①~⑤ 등) */
  marker: z.string().nullable().optional(),
  /** 그 선지 그림이 있는 이미지의 0-base 인덱스 */
  imageSourceIndex: z.number().int().nullable().optional(),
  /** 선지 그림 하나만 타이트하게 감싼 경계상자 */
  imageBox: BoxSchema,
});

/** Claude가 추출해야 하는 단일 문항 구조 */
export const AnalyzedQuestionSchema = z.object({
  number: z.number().int().nullable().optional(),
  stem: z.string().min(1),
  passage: z.string().nullable().optional(),
  /** 문항에 그림/지도/사진/도표가 있으면 그 시각 자료를 글로 묘사 (없으면 null) */
  imageDescription: z.string().nullable().optional(),
  /** 그림이 있는 이미지의 0-base 인덱스 (업로드 순서) — 클라이언트 크롭용 */
  imageSourceIndex: z.number().int().nullable().optional(),
  /** 문항 전체(번호~마지막 선지) 영역 — 크롭 클램프(2단 오염 방지)·부분 재분석용 */
  questionBox: BoxSchema.nullable().optional(),
  /** 그림 영역의 정규화 좌표 (0~1, 좌상단 원점) — 클라이언트 크롭용 */
  imageBox: BoxSchema.nullable().optional(),
  /** 배점([n점]) 표시가 있는 줄의 바로 아래 y (0~1) — 그림 세로 시작 기준 */
  scoreMarkerY: z.number().nullable().optional(),
  /** 보기 ①(숫자 1번) 가 시작되는 바로 위 y (0~1) — 그림 세로 끝 기준 */
  choicesTopY: z.number().nullable().optional(),
  /** 잘라낸 그림 이미지 (data URL) — 클라이언트가 크롭 후 채움 */
  imageUrl: z.string().nullable().optional(),
  /**
   * 선지 배열. 글 선지는 문자열, 그림 선지는 {text,imageUrl} 객체.
   * AI는 문자열(라벨)로 반환하고, 그림 선지는 클라이언트가 크롭 후 객체로 치환한다.
   */
  choices: z.array(z.union([z.string().min(1), ChoiceObjSchema])).min(2).max(5),
  /** 선지 종류: text=글 선지, image=그림 선지(사진·지도·유물 등) */
  choiceKind: z.enum(["text", "image"]).nullable().optional(),
  /** 그림 선지일 때 각 선지 그림의 위치 (choices와 같은 순서·길이) */
  choiceImages: z.array(ChoiceFigureSchema).nullable().optional(),
  answerIndex: z.number().int().min(0),
  /** 정답 근거 출처: "답지"=답안지에서 확인, "추정"=한국사 지식으로 추정 */
  answerSource: z.enum(["답지", "추정"]).nullable().optional(),
  explanation: z.string().nullable().optional(),
  era: z.enum(ERA_KEYS as [string, ...string[]]),
  topics: z.array(z.string()).default([]),
  qType: z.enum(qTypeKeys).default("기타"),
  difficulty: z.number().int().min(1).max(5).nullable().optional(),
});

export const AnalyzeResultSchema = z.object({
  level: z.enum(["SIMHWA", "GIBON"]).nullable().optional(),
  examRound: z.number().int().nullable().optional(),
  examYear: z.number().int().nullable().optional(),
  questions: z.array(AnalyzedQuestionSchema),
});

export type AnalyzedQuestion = z.infer<typeof AnalyzedQuestionSchema>;
export type AnalyzeResult = z.infer<typeof AnalyzeResultSchema>;

/**
 * Anthropic tool_use 용 JSON Schema.
 * (zod와 동기화 — 구조화 출력을 강제하기 위해 tool input_schema로 전달)
 */
export const ANALYZE_TOOL_SCHEMA = {
  type: "object" as const,
  properties: {
    level: {
      type: ["string", "null"],
      enum: ["SIMHWA", "GIBON", null],
      description: "시험 등급. 심화=SIMHWA, 기본=GIBON. 판단 불가 시 null",
    },
    examRound: { type: ["integer", "null"], description: "회차 번호(예: 68). 없으면 null" },
    examYear: { type: ["integer", "null"], description: "시행 연도(예: 2023). 없으면 null" },
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: ["integer", "null"], description: "문항 번호" },
          stem: { type: "string", description: "문제 발문 전체" },
          passage: {
            type: ["string", "null"],
            description: "사료/자료 제시 지문(있으면 원문 그대로). 텍스트 자료에 한함",
          },
          imageDescription: {
            type: ["string", "null"],
            description:
              "문항에 그림·지도·사진·유물·도표 등 시각 자료가 있으면 그 내용을 한국사 지식으로 구체적으로 묘사(예: '석굴암 본존불 사진', '대동여지도 일부', '신문 호외 이미지'). 시각 자료가 없으면 null",
          },
          imageSourceIndex: {
            type: ["integer", "null"],
            description:
              "그림이 들어 있는 이미지의 인덱스. 각 이미지 앞에 '[이미지 N: 역할]' 라벨이 붙어 있으니 그 N(0-base)을 그대로 사용. 시각 자료가 없으면 null",
          },
          questionBox: {
            type: ["object", "null"],
            description:
              "이 문항 전체(문항 번호부터 마지막 선지 끝까지)를 감싸는 정규화 경계상자(0~1). 시험지가 2단(좌/우 컬럼)이면 그 문항이 속한 단 안으로만 잡는다. 이 문항의 imageBox·choiceImages 상자는 모두 이 영역 안에 있어야 한다. 모든 문항에 채운다",
            properties: {
              x: { type: "number", description: "왼쪽 경계 (0~1)" },
              y: { type: "number", description: "위쪽 경계 (0~1)" },
              width: { type: "number", description: "너비 (0~1)" },
              height: { type: "number", description: "높이 (0~1)" },
            },
          },
          imageBox: {
            type: ["object", "null"],
            description:
              "그림 영역의 정규화 경계상자(0~1). 해당 이미지의 좌상단이 (0,0), 우하단이 (1,1). 그림(지도·사진·유물·도표)만 감싸도록 최대한 타이트하게. 선지·발문 텍스트는 제외. 주로 가로(x, width) 추정에 사용됨. 시각 자료가 없으면 null",
            properties: {
              x: { type: "number", description: "왼쪽 경계 (0~1)" },
              y: { type: "number", description: "위쪽 경계 (0~1)" },
              width: { type: "number", description: "너비 (0~1)" },
              height: { type: "number", description: "높이 (0~1)" },
            },
          },
          scoreMarkerY: {
            type: ["number", "null"],
            description:
              "해당 문항의 배점 표시([2점]·[3점] 등)가 있는 줄의 바로 아래 세로 위치(0~1). 배점은 발문 끝에 표시되며, 그림은 정확히 이 지점 바로 아래에서 시작함. 배점이 안 보이면 발문 마지막 줄 바로 아래로 추정. 시각 자료가 없으면 null",
          },
          choicesTopY: {
            type: ["number", "null"],
            description:
              "해당 문항 보기 ①(숫자 1번 선지)의 첫 줄이 시작되는 바로 위 세로 위치(0~1). 그림은 정확히 이 지점 바로 위에서 끝남. 시각 자료가 없으면 null",
          },
          choices: {
            type: "array",
            items: { type: "string" },
            description:
              "선지 배열(보통 4~5개). 글 선지는 그 텍스트를, 그림 선지(사진·지도·유물·탑 등)는 각 그림을 한국사 지식으로 식별한 짧은 라벨을 순서대로 넣는다(예: ['월정사 8각 9층 석탑','경천사지 10층 석탑']). 식별이 어려우면 '선지 1 그림'처럼이라도 채운다",
          },
          choiceKind: {
            type: ["string", "null"],
            enum: ["text", "image", null],
            description:
              "선지 종류. 선지가 사진·지도·유물·탑 등 그림이면 'image', 글자면 'text'",
          },
          choiceImages: {
            type: ["array", "null"],
            description:
              "선지가 그림('image')일 때만 채운다. choices와 같은 순서·개수로 각 선지 그림의 위치를 넣는다. 선지 그림은 보통 ①②③④⑤ 마커 아래 격자로 배치됨. 글 선지면 null",
            items: {
              type: "object",
              properties: {
                marker: { type: ["string", "null"], description: "선지 번호(①~⑤ 등)" },
                imageSourceIndex: {
                  type: ["integer", "null"],
                  description: "그 선지 그림이 있는 이미지 인덱스(0-base)",
                },
                imageBox: {
                  type: "object",
                  description:
                    "선지 그림 하나만 타이트하게 감싼 정규화 경계상자(0~1). 선지 번호·여백은 제외",
                  properties: {
                    x: { type: "number", description: "왼쪽 경계 (0~1)" },
                    y: { type: "number", description: "위쪽 경계 (0~1)" },
                    width: { type: "number", description: "너비 (0~1)" },
                    height: { type: "number", description: "높이 (0~1)" },
                  },
                },
              },
              required: ["imageBox"],
            },
          },
          answerIndex: {
            type: "integer",
            description:
              "정답 선지의 0-base 인덱스. 답안지(답지)가 함께 제공되면 반드시 답지의 정답으로 설정. 답지에 없으면 한국사 지식으로 추정",
          },
          answerSource: {
            type: ["string", "null"],
            enum: ["답지", "추정", null],
            description:
              "정답 출처. 답안지에서 확인했으면 '답지', 한국사 지식으로 추정했으면 '추정'",
          },
          explanation: { type: ["string", "null"], description: "해설(있으면)" },
          era: {
            type: "string",
            enum: ERA_KEYS,
            description: "시대 구분 키",
          },
          topics: {
            type: "array",
            items: { type: "string" },
            description: "핵심 인물/사건/제도 태그(예: ['광종','과거제'])",
          },
          qType: {
            type: "string",
            enum: QUESTION_TYPES.map((q) => q.key),
            description: "문항 유형",
          },
          difficulty: {
            type: ["integer", "null"],
            description: "추정 난이도 1(쉬움)~5(어려움)",
          },
        },
        required: ["stem", "choices", "answerIndex", "era"],
      },
    },
  },
  required: ["questions"],
};
