import { describe, it, expect } from "vitest";
import { gradeExam } from "./scoring";
import { scoreToGrade } from "./domain";

describe("모의고사 채점", () => {
  it("50문항 전부 정답이면 100점 1급(심화)", () => {
    const answers = Array.from({ length: 50 }, (_, i) => ({
      questionId: `q${i}`,
      selected: 0,
      answerIndex: 0,
    }));
    const r = gradeExam("SIMHWA", answers);
    expect(r.correct).toBe(50);
    expect(r.score100).toBe(100);
    expect(r.grade.label).toBe("1급");
    expect(r.grade.passed).toBe(true);
  });

  it("문항 수가 적어도 100점 만점 비례 환산", () => {
    const answers = Array.from({ length: 10 }, (_, i) => ({
      questionId: `q${i}`,
      selected: i < 8 ? 0 : 1, // 8/10 정답
      answerIndex: 0,
    }));
    const r = gradeExam("SIMHWA", answers);
    expect(r.correct).toBe(8);
    expect(r.score100).toBe(80); // 8/10 → 80점
  });

  it("미응답은 오답 처리", () => {
    const answers = [
      { questionId: "a", selected: null, answerIndex: 0 },
      { questionId: "b", selected: 0, answerIndex: 0 },
    ];
    const r = gradeExam("GIBON", answers);
    expect(r.answered).toBe(1);
    expect(r.correct).toBe(1);
  });
});

describe("급수 환산", () => {
  it("심화 임계값", () => {
    expect(scoreToGrade("SIMHWA", 80).grade).toBe(1);
    expect(scoreToGrade("SIMHWA", 70).grade).toBe(2);
    expect(scoreToGrade("SIMHWA", 60).grade).toBe(3);
    expect(scoreToGrade("SIMHWA", 59).passed).toBe(false);
  });
  it("기본 임계값", () => {
    expect(scoreToGrade("GIBON", 80).grade).toBe(4);
    expect(scoreToGrade("GIBON", 70).grade).toBe(5);
    expect(scoreToGrade("GIBON", 60).grade).toBe(6);
    expect(scoreToGrade("GIBON", 50).passed).toBe(false);
  });
});
