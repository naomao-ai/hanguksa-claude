/**
 * SM-2 기반 간격 반복(Spaced Repetition) 알고리즘.
 * 오답노트 복습 일정을 산출한다. (SuperMemo SM-2 변형)
 *
 * grade(품질): 0~5
 *   0~2 = 오답(다시), 3 = 어렵게 정답, 4 = 정답, 5 = 쉽게 정답
 */

export interface SrsState {
  /** 반복 횟수 (연속 정답) */
  repetition: number;
  /** 용이도 계수 (최소 1.3) */
  easeFactor: number;
  /** 다음 복습까지 간격(일) */
  interval: number;
  /** 다음 복습 예정일 (epoch ms) */
  due: number;
}

export function initialSrs(now: number): SrsState {
  return { repetition: 0, easeFactor: 2.5, interval: 0, due: now };
}

const DAY = 86_400_000;

/**
 * 복습 결과를 반영해 다음 상태를 계산한다.
 * @param state 이전 상태
 * @param grade  0~5 품질 점수
 * @param now    현재 시각(ms)
 */
export function reviewSrs(state: SrsState, grade: number, now: number): SrsState {
  const q = Math.max(0, Math.min(5, Math.round(grade)));

  let { repetition, easeFactor, interval } = state;

  if (q < 3) {
    // 오답 → 처음부터 다시, 단기 재노출(10분 후)
    repetition = 0;
    interval = 0;
    const due = now + 10 * 60 * 1000;
    return { repetition, easeFactor: clampEF(easeFactor), interval, due };
  }

  // 정답 흐름
  if (repetition === 0) interval = 1;
  else if (repetition === 1) interval = 6;
  else interval = Math.round(interval * easeFactor);

  repetition += 1;

  // 용이도 계수 갱신 (SM-2 공식)
  easeFactor = easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  easeFactor = clampEF(easeFactor);

  const due = now + interval * DAY;
  return { repetition, easeFactor, interval, due };
}

function clampEF(ef: number): number {
  return Math.max(1.3, Math.round(ef * 100) / 100);
}

/** 채점 정오 + 체감 난이도를 SM-2 품질 점수로 변환 */
export function toGrade(correct: boolean, perceived?: "easy" | "normal" | "hard"): number {
  if (!correct) return 1;
  if (perceived === "easy") return 5;
  if (perceived === "hard") return 3;
  return 4;
}

/** 지금 복습 대상인지 */
export function isDue(state: SrsState, now: number): boolean {
  return state.due <= now;
}
