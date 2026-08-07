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
import ScrapBottomSheet from "@/components/ScrapBottomSheet";
import CorePoint from "@/components/CorePoint";
import { parsePassage } from "@/lib/passage";

export default function ExamRunner({
  questions, level, onExit,
}: {
  questions: QuestionDTO[];
  level: Level;
  onExit: () => void;
}) {
  const { update, store } = useStore();
  const { confirm } = useUI();
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [cur, setCur] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showImgDesc, setShowImgDesc] = useState(false);

  useEffect(() => {
    setShowImgDesc(false);
  }, [cur]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(EXAM_DURATION_MIN * 60);
  const [scrapTarget, setScrapTarget] = useState<{id: string, title: string} | null>(null);

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
          examRound: qq.examRound ?? null,
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
    return <ExamResultView questions={questions} answers={answers} result={result} onExit={onExit} setScrapTarget={setScrapTarget} />;
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* 좌측: 사료 및 문제 영역 */}
        <div className="card p-5 space-y-4 sticky top-4">
          <div className="flex items-center justify-between text-xs">
            <div className="flex gap-1.5">
              <span className="rounded bg-surface-2 px-2 py-0.5">{cur + 1}번</span>
              <span className="rounded bg-surface-2 px-2 py-0.5">{eraLabel(q.era)}</span>
            </div>
            <button
              className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              onClick={() => setScrapTarget({ id: q.id, title: q.stem })}
              title="이 문제 수집하기"
            >
              🔖 수집
            </button>
          </div>
          <p className="text-lg font-semibold leading-relaxed">{q.stem}</p>
          
          {/* 자료/사료 — 그림 유무와 무관하게 항상 표시(밑줄 지문·사료 등 풀이 필수 본문).
              [역사 신문]·[답사 보고서] 등 자료 형식 라벨은 제목 badge로 분리한다. */}
          {q.passage && (() => {
            const { label, body } = parsePassage(q.passage);
            return (
              <div className="overflow-hidden rounded-lg border-l-4 border-gold bg-surface-2">
                {label && (
                  <div className="bg-gold/15 px-3 py-1.5 text-xs font-bold text-gold">{label}</div>
                )}
                <blockquote className="p-3 text-sm whitespace-pre-wrap break-keep">{body}</blockquote>
              </div>
            );
          })()}
          {q.imageUrl && (
            <div className="relative group rounded-lg border overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={q.imageUrl}
                alt="자료"
                className={cn("max-h-72 w-full object-contain", q.imageDescription && "cursor-pointer")}
                onClick={() => q.imageDescription && setShowImgDesc(p => !p)}
              />
              {/* 삽화 설명(imageDescription)만 클릭 토글 — 본문 지문은 위에 이미 노출됨 */}
              {q.imageDescription && (
                <button
                  onClick={() => setShowImgDesc(p => !p)}
                  className="absolute bottom-2 right-2 bg-black/60 text-white p-1.5 rounded-md hover:bg-black/80 transition-colors flex items-center gap-1.5 text-xs shadow-md"
                  title="설명 보기"
                >
                  <ImageIcon size={14} /> 설명 보기
                </button>
              )}
              {q.imageDescription && showImgDesc && (
                <div
                  className="absolute inset-0 bg-black/85 text-white/95 p-5 overflow-y-auto text-sm leading-relaxed flex items-center justify-center cursor-pointer animate-in fade-in zoom-in-95 duration-200"
                  onClick={() => setShowImgDesc(false)}
                >
                  <div className="max-w-sm text-center flex flex-col items-center gap-3">
                    <div className="font-bold text-accent border-b border-white/20 pb-2 inline-block">[자료 설명]</div>
                    <p className="break-keep">{q.imageDescription}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="mt-5 flex justify-between">
            <button className="btn btn-outline px-4 py-2" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0}>이전</button>
            <button className="btn btn-outline px-4 py-2" onClick={() => setCur((c) => Math.min(questions.length - 1, c + 1))} disabled={cur === questions.length - 1}>다음</button>
          </div>
        </div>

        {/* 우측: OMR 및 선지 영역 */}
        <div className="space-y-4">
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

          <div className="card p-5 space-y-2">
            <h3 className="mb-3 text-sm font-bold text-muted">선택지</h3>
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
        </div>
      </div>

      {scrapTarget && (
        <ScrapBottomSheet 
          isOpen={!!scrapTarget} 
          onClose={() => setScrapTarget(null)} 
          questionId={scrapTarget.id}
          title={scrapTarget.title}
        />
      )}
    </div>
  );
}


function ExamResultView({
  questions, answers, result, onExit, setScrapTarget
}: {
  questions: QuestionDTO[];
  answers: (number | null)[];
  result: ExamResult;
  onExit: () => void;
  setScrapTarget: (t: {id: string, title: string} | null) => void;
}) {
  const { toast } = useUI();
  const [review, setReview] = useState(false);
  const [similarCounts, setSimilarCounts] = useState<Record<string, number>>({});

  // 리뷰 오픈 시 오답 문항들의 유사 문제 개수 일괄 조회
  useEffect(() => {
    if (!review) return;
    const wrongQs = questions.filter((q, i) => answers[i] !== q.answerIndex);
    wrongQs.forEach(async (q) => {
      const sp = new URLSearchParams();
      if (q.factIds && q.factIds.length > 0) {
        sp.set("factId", q.factIds[0]);
      } else {
        sp.set("era", q.era);
      }
      sp.set("limit", "50");
      try {
        const res = await fetch(`/api/questions?${sp.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const count = (data.questions as QuestionDTO[]).filter(x => x.id !== q.id).length;
          setSimilarCounts((prev) => ({ ...prev, [q.id]: count }));
        }
      } catch {}
    });
  }, [review, questions, answers]);

  const handleSimilarQuestion = async (q: QuestionDTO) => {
    // 사실 기반(factId) 혹은 같은 시대(era)의 다른 문제 검색
    const sp = new URLSearchParams();
    if (q.factIds && q.factIds.length > 0) {
      sp.set("factId", q.factIds[0]);
    } else {
      sp.set("era", q.era);
    }
    sp.set("random", "1");
    sp.set("limit", "2");

    try {
      const res = await fetch(`/api/questions?${sp.toString()}`);
      if (res.ok) {
        const data = await res.json();
        const similar = (data.questions as QuestionDTO[]).find(x => x.id !== q.id);
        if (similar) {
          // 비슷한 문제 모달 띄우기나 해당 문제 풀이 페이지로 이동할 수 있습니다.
          // 현재는 스터디 페이지로 이동하여 단일 문제를 풉니다.
          window.location.href = `/study?q=${similar.id}`;
          return;
        }
      }
      toast("비슷한 유형의 문제를 찾지 못했습니다.", "info");
    } catch (e) {
      toast("오류가 발생했습니다.", "error");
    }
  };

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
                <div className="mb-1 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className={cn("font-bold", correct ? "text-green-600" : "text-red-500")}>
                      {i + 1}. {correct ? "정답" : "오답"}
                    </span>
                    <span className="text-muted">{eraLabel(q.era)}</span>
                  </div>
                  <button 
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                    onClick={() => setScrapTarget({ id: q.id, title: q.stem })}
                  >
                    🔖 수집하기
                  </button>
                </div>
                <p className="text-sm font-medium">{q.stem}</p>
                <p className="mt-1 text-sm text-muted">
                  내 답: {sel !== null ? `${sel + 1}번` : "미응답"} / 정답: {q.answerIndex + 1}번
                </p>
                {q.corePoint && <CorePoint data={q.corePoint as any} className="mt-2 mb-1" />}
                {q.explanation && <p className="mt-1 rounded bg-surface-2 p-2 text-sm">{q.explanation}</p>}
                
                {!correct && (
                  <div className="mt-3 flex justify-end">
                    <button 
                      className="btn bg-accent/10 text-accent hover:bg-accent/20 px-3 py-1.5 text-xs font-medium"
                      onClick={() => handleSimilarQuestion(q)}
                    >
                      비슷한 유형 다시 풀기{similarCounts[q.id] != null && similarCounts[q.id] > 0 ? ` (${similarCounts[q.id]}문제)` : ""}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
