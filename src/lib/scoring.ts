import {
  EXAM_TOTAL_QUESTIONS,
  POINTS_PER_QUESTION,
  scoreToGrade,
  type GradeResult,
  type Level,
} from "./domain";

export interface ExamAnswer {
  questionId: string;
  selected: number | null; // 선택한 선지 (null = 미응답)
  answerIndex: number; // 정답
}

export interface ExamResult {
  total: number;
  answered: number;
  correct: number;
  /** 100점 만점 환산 점수 */
  score100: number;
  /** 원점수(정답 수 × 문항당 점수) */
  rawScore: number;
  grade: GradeResult;
  /** 문항별 정오 */
  marks: { questionId: string; correct: boolean; selected: number | null }[];
}

/**
 * 모의고사 채점. 한능검 표준은 50문항 × 2점 = 100점.
 * 문항 수가 50과 달라도 100점 만점으로 비례 환산한다.
 */
export function gradeExam(level: Level, answers: ExamAnswer[]): ExamResult {
  const total = answers.length;
  let correct = 0;
  let answered = 0;
  const marks = answers.map((a) => {
    const isCorrect = a.selected !== null && a.selected === a.answerIndex;
    if (a.selected !== null) answered += 1;
    if (isCorrect) correct += 1;
    return { questionId: a.questionId, correct: isCorrect, selected: a.selected };
  });

  const rawScore = correct * POINTS_PER_QUESTION;
  // 표준(50문항) 기준 100점 만점 비례 환산
  const score100 =
    total > 0 ? Math.round((correct / total) * EXAM_TOTAL_QUESTIONS * POINTS_PER_QUESTION) : 0;

  return {
    total,
    answered,
    correct,
    rawScore,
    score100,
    grade: scoreToGrade(level, score100),
    marks,
  };
}
