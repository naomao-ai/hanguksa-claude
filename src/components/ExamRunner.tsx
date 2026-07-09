"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/useStore";
import { useUI } from "@/components/ui/UIProvider";
import { recordAttempt, recordExamResult } from "@/lib/local-store";
import { gradeExam, type ExamResult } from "@/lib/scoring";
import { EXAM_DURATION_MIN, eraLabel, levelLabel, type Level } from "@/lib/domain";
import { cn, pct } from "@/lib/utils";
import type { QuestionDTO } from "@/lib/types";
import { Clock, RotateCcw, Image as ImageIcon } from "lucide-react";

export default function ExamRunner({
  questions, level, onExit,
}: {
  questions: QuestionDTO[];
  level: Level;
  onExit: () => void;
}) {
  const { update } = useStore();
  const { confirm } = useUI();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [cur, setCur] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_DURATION_MIN * 60);

  const q = questions[cur];

  function submit() {
    const examAnswers = questions.map((qq, i) => ({
      questionId: qq.id,
      selected: answers[i],
      answerIndex: qq.answerIndex,
    }));
    const r = gradeExam(level, examAnswers);
    setResult(r);
    setSubmitted(true);
    // 학습 기록 + 모의고사 이력 반영 (이력이 있어야 점수 추이·합격권 판단 가능)
    update((s) => {
      let next = s;
      questions.forEach((qq, i) => {
        if (answers[i] === null) return;
        next = recordAttempt(next, {
          questionId: qq.id,
          correct: answers[i] === qq.answerIndex,
          selected: answers[i],
          era: qq.era,
          qType: qq.qType,
          level: qq.level,
          source: "exam",
        });
      });
      return recordExamResult(next, {
        level,
        score100: r.score100,
        correct: r.correct,
        total: r.total,
        grade: r.grade.grade,
        passed: r.grade.passed,
      });
    });
  }

  // 타이머
  useEffect(() => {
    if (submitted) return;
    if (secondsLeft <= 0) { submit(); return; }
    const t = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, submitted]);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const answeredCount = answers.filter((a) => a !== null).length;

  if (submitted && result) {
    return <ExamResultView questions={questions} answers={answers} result={result} onExit={onExit} />;
  }

  return (
    <div className="space-y-4">
      {/* 상단 바: 타이머 + 진행 */}
      <div className="card flex items-center justify-between p-3">
        <span className="flex items-center gap-1.5 font-mono text-lg font-bold">
          <Clock size={18} className={secondsLeft < 300 ? "text-accent" : "text-muted"} />
          {mm}:{ss}
        </span>
        <span className="text-sm text-muted">{answeredCount} / {questions.length} 응답</span>
        <button
          className="btn btn-accent px-4 py-1.5 text-sm"
          onClick={async () => {
            const unanswered = answers.filter((a) => a === null).length;
            const ok = await confirm({
              title: "모의고사 제출",
              body: unanswered > 0 ? `미응답 ${unanswered}문항이 있습니다. 제출할까요?` : "답안을 제출하고 채점할까요?",
              confirmText: "제출",
            });
            if (ok) submit();
          }}
        >
          제출
        </button>
      </div>

      {/* OMR 그리드 */}
      <div className="card flex flex-wrap gap-1 p-3">
        {questions.map((_, i) => (
          <button
            key={i}
            onClick={() => setCur(i)}
            className={cn(
              "h-7 w-7 rounded text-xs font-medium transition-colors",
              i === cur && "ring-2 ring-primary",
              answers[i] !== null ? "bg-primary text-primary-fg" : "bg-surface-2 text-muted"
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* 현재 문항 */}
      <div className="card p-5">
        <div className="mb-2 flex gap-1.5 text-xs">
          <span className="rounded bg-surface-2 px-2 py-0.5">{cur + 1}번</span>
          <span className="rounded bg-surface-2 px-2 py-0.5">{eraLabel(q.era)}</span>
        </div>
        {q.passage && (
          <blockquote className="mb-3 rounded-lg border-l-4 border-gold bg-surface-2 p-3 text-sm">{q.passage}</blockquote>
        )}
        {q.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.imageUrl} alt="자료" className="mb-3 max-h-72 rounded-lg border" />
        )}
        {q.imageDescription && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3 text-sm">
            <ImageIcon size={16} className="mt-0.5 shrink-0 text-accent" />
            <span><span className="font-medium text-accent">[자료]</span> {q.imageDescription}</span>
          </div>
        )}
        <p className="mb-4 text-lg font-semibold leading-relaxed">{q.stem}</p>
        <div className="space-y-2">
          {q.choices.map((c, i) => (
            <button
              key={c.id}
              onClick={() => setAnswers((a) => a.map((x, idx) => (idx === cur ? i : x)))}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                answers[cur] === i ? "border-primary bg-primary/10" : "hover:bg-surface-2"
              )}
            >
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-full border text-sm font-bold",
                answers[cur] === i && "border-primary text-primary")}>{i + 1}</span>
              <span className="flex flex-col gap-1">
                {c.text && <span>{c.text}</span>}
                {c.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt={`선지 ${i + 1}`} className="max-h-40 rounded border" />
                )}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-5 flex justify-between">
          <button className="btn btn-outline px-4 py-2" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0}>이전</button>
          <button className="btn btn-outline px-4 py-2" onClick={() => setCur((c) => Math.min(questions.length - 1, c + 1))} disabled={cur === questions.length - 1}>다음</button>
        </div>
      </div>
    </div>
  );
}

function ExamResultView({
  questions, answers, result, onExit,
}: {
  questions: QuestionDTO[];
  answers: (number | null)[];
  result: ExamResult;
  onExit: () => void;
}) {
  const [review, setReview] = useState(false);
  return (
    <div className="space-y-4">
      <div className="card p-6 text-center">
        <h2 className="text-2xl font-bold">채점 결과</h2>
        <div className="my-4 text-5xl font-extrabold text-primary">{result.score100}점</div>
        <p className={cn("text-lg font-bold", result.grade.passed ? "text-green-600" : "text-red-500")}>
          {result.grade.passed ? `합격 — ${result.grade.label}` : "불합격"}
        </p>
        <p className="mt-1 text-muted">
          {result.total}문항 중 {result.correct}문항 정답 · 정답률 {pct(result.correct / result.total)}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn btn-outline px-4 py-2" onClick={() => setReview((r) => !r)}>
            {review ? "해설 닫기" : "문항 해설 보기"}
          </button>
          <button className="btn btn-outline px-4 py-2" onClick={onExit}><RotateCcw size={16} /> 다시</button>
          <Link href="/analytics" className="btn btn-primary px-4 py-2">통계 보기</Link>
        </div>
      </div>

      {review && (
        <div className="space-y-2">
          {questions.map((q, i) => {
            const sel = answers[i];
            const correct = sel === q.answerIndex;
            return (
              <div key={q.id} className="card p-4">
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <span className={cn("font-bold", correct ? "text-green-600" : "text-red-500")}>
                    {i + 1}. {correct ? "정답" : "오답"}
                  </span>
                  <span className="text-muted">{eraLabel(q.era)}</span>
                </div>
                <p className="text-sm font-medium">{q.stem}</p>
                <p className="mt-1 text-sm text-muted">
                  내 답: {sel !== null ? `${sel + 1}번` : "미응답"} / 정답: {q.answerIndex + 1}번
                </p>
                {q.explanation && <p className="mt-1 rounded bg-surface-2 p-2 text-sm">{q.explanation}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
