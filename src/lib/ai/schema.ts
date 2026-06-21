import { z } from "zod";
import { ERA_KEYS, QUESTION_TYPES } from "@/lib/domain";

const qTypeKeys = QUESTION_TYPES.map((q) => q.key) as [string, ...string[]];

/** Claude가 추출해야 하는 단일 문항 구조 */
export const AnalyzedQuestionSchema = z.object({
  number: z.number().int().nullable().optional(),
  stem: z.string().min(1),
  passage: z.string().nullable().optional(),
  /** 문항에 그림/지도/사진/도표가 있으면 그 시각 자료를 글로 묘사 (없으면 null) */
  imageDescription: z.string().nullable().optional(),
  /** 그림이 있는 이미지의 0-base 인덱스 (업로드 순서) — 클라이언트 크롭용 */
  imageSourceIndex: z.number().int().nullable().optional(),
  /** 그림 영역의 정규화 좌표 (0~1, 좌상단 원점) — 클라이언트 크롭용 */
  imageBox: z
    .object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() })
    .nullable()
    .optional(),
  /** 배점([n점]) 표시가 있는 줄의 바로 아래 y (0~1) — 그림 세로 시작 기준 */
  scoreMarkerY: z.number().nullable().optional(),
  /** 보기 ①(숫자 1번) 가 시작되는 바로 위 y (0~1) — 그림 세로 끝 기준 */
  choicesTopY: z.number().nullable().optional(),
  /** 잘라낸 그림 이미지 (data URL) — 클라이언트가 크롭 후 채움 */
  imageUrl: z.string().nullable().optional(),
  choices: z.array(z.string().min(1)).min(2).max(5),
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
            description: "선지 텍스트 배열(보통 4~5개)",
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
