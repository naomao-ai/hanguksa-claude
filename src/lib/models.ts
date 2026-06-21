/**
 * AI 분석에 사용할 수 있는 모델 목록 (UI 선택 + 서버 검증 공용).
 * 비용은 입력/출력 per 1M 토큰 기준.
 */
export interface AiModel {
  id: string;
  label: string;
  cost: string;
  note: string;
}

export const AI_MODELS: AiModel[] = [
  { id: "claude-opus-4-8", label: "Opus 4.8", cost: "$5 / $25", note: "최고 정확도" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6", cost: "$3 / $15", note: "균형 · 약 40% 절감" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5", cost: "$1 / $5", note: "최저가 · 약 80% 절감" },
];

export const DEFAULT_MODEL = "claude-opus-4-8";

export const MODEL_IDS = AI_MODELS.map((m) => m.id);

export function isValidModel(id: unknown): id is string {
  return typeof id === "string" && MODEL_IDS.includes(id);
}
