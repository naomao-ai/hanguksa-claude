"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/useStore";
import { recordAttempt, toggleBookmark } from "@/lib/local-store";
import { eraLabel, qTypeLabel, levelLabel } from "@/lib/domain";
import { cn, pct } from "@/lib/utils";
import type { QuestionDTO } from "@/lib/types";
import { Bookmark, BookmarkCheck, CheckCircle2, XCircle, MessageCircleQuestion, ArrowRight, RotateCcw, Image as ImageIcon } from "lucide-react";

export default function StudyRunner({ questions }: { questions: QuestionDTO[] }) {
  const { update, store } = useStore();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  const q = questions[idx];
  const done = idx >= questions.length;
  const bookmarked = useMemo(
    () => (q ? store.bookmarks.includes(q.id) : false),
    [store.bookmarks, q]
  );

  function choose(i: number) {
    if (revealed) return;
    setSelected(i);
  }

  function submit() {
    if (selected === null || !q) return;
    const correct = selected === q.answerIndex;
    setRevealed(true);
    setResults((r) => [...r, correct]);
    update((s) =>
      recordAttempt(s, {
        questionId: q.id,
        correct,
        selected,
        era: q.era,
        qType: q.qType,
        level: q.level,
      })
    );
  }

  function next() {
    setIdx((i) => i + 1);
    setSelected(null);
    setRevealed(false);
  }

  // 키보드 단축키: 1~5 선택, Enter 정답확인/다음
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (done || !q) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const n = Number(e.key);
      if (!revealed && Number.isInteger(n) && n >= 1 && n <= q.choices.length) {
        choose(n - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!revealed) submit();
        else next();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, done, revealed, selected]);

  if (questions.length === 0) {
    return (
      <div className="card p-8 text-center text-muted">
        조건에 맞는 문항이 없습니다. 문제은행에 문항을 추가하거나 필터를 바꿔보세요.
      </div>
    );
  }

  if (done) {
    const correct = results.filter(Boolean).length;
    return (
      <div className="card p-8 text-center">
        <h2 className="mb-2 text-2xl font-bold">학습 완료 🎉</h2>
        <p className="mb-1 text-lg">
          {questions.length}문항 중 <b className="text-primary">{correct}문항</b> 정답
        </p>
        <p className="mb-6 text-muted">정답률 {pct(correct / questions.length)}</p>
        <div className="flex justify-center gap-2">
          <button
            className="btn btn-outline px-4 py-2"
            onClick={() => {
              setIdx(0);
              setSelected(null);
              setRevealed(false);
              setResults([]);
            }}
          >
            <RotateCcw size={16} /> 다시 풀기
          </button>
          <Link href="/analytics" className="btn btn-primary px-4 py-2">
            통계 보기 <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in">
      {/* 진행바 */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(idx / questions.length) * 100}%` }}
          />
        </div>
        <span className="shrink-0 text-sm text-muted">
          {idx + 1} / {questions.length}
        </span>
      </div>

      <div className="card p-5 sm:p-6">
        {/* 메타 태그 */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="rounded bg-primary/12 px-2 py-0.5 font-medium text-primary">
            {levelLabel(q.level)}
          </span>
          <span className="rounded bg-surface-2 px-2 py-0.5">{eraLabel(q.era)}</span>
          <span className="rounded bg-surface-2 px-2 py-0.5">{qTypeLabel(q.qType)}</span>
          {q.examRound && (
            <span className="rounded bg-surface-2 px-2 py-0.5">{q.examRound}회</span>
          )}
          <button
            className="ml-auto text-muted hover:text-accent"
            onClick={() => update((s) => toggleBookmark(s, q.id))}
            title="즐겨찾기"
          >
            {bookmarked ? <BookmarkCheck size={18} className="text-accent" /> : <Bookmark size={18} />}
          </button>
        </div>

        {/* 자료/사료 */}
        {q.passage && (
          <blockquote className="mb-3 rounded-lg border-l-4 border-gold bg-surface-2 p-3 text-sm leading-relaxed">
            {q.passage}
          </blockquote>
        )}
        {q.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={q.imageUrl} alt="자료" className="mb-3 max-h-72 rounded-lg" />
        )}
        {q.imageDescription && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-dashed border-accent/40 bg-accent/5 p-3 text-sm leading-relaxed">
            <ImageIcon size={16} className="mt-0.5 shrink-0 text-accent" />
            <span><span className="font-medium text-accent">[자료]</span> {q.imageDescription}</span>
          </div>
        )}

        {/* 발문 */}
        <p className="mb-4 text-lg font-semibold leading-relaxed">{q.stem}</p>

        {/* 선지 */}
        <div className="space-y-2">
          {q.choices.map((c, i) => {
            const isAnswer = i === q.answerIndex;
            const isSelected = i === selected;
            return (
              <button
                key={c.id}
                onClick={() => choose(i)}
                disabled={revealed}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                  !revealed && isSelected && "border-primary bg-primary/10",
                  !revealed && !isSelected && "hover:bg-surface-2",
                  revealed && isAnswer && "border-green-500 bg-green-500/10",
                  revealed && isSelected && !isAnswer && "border-red-500 bg-red-500/10",
                  revealed && !isAnswer && !isSelected && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 shrink-0 place-items-center rounded-full border text-sm font-bold",
                    !revealed && isSelected && "border-primary text-primary",
                    revealed && isAnswer && "border-green-500 text-green-600",
                    revealed && isSelected && !isAnswer && "border-red-500 text-red-600"
                  )}
                >
                  {i + 1}
                </span>
                <span className="flex-1">{c.text}</span>
                {revealed && isAnswer && <CheckCircle2 size={18} className="text-green-600" />}
                {revealed && isSelected && !isAnswer && <XCircle size={18} className="text-red-600" />}
              </button>
            );
          })}
        </div>

        {/* 해설 */}
        {revealed && q.explanation && (
          <div className="mt-4 rounded-lg bg-surface-2 p-3 text-sm leading-relaxed">
            <b className="text-primary">해설</b> · {q.explanation}
          </div>
        )}

        {/* 액션 */}
        <div className="mt-5 flex items-center gap-2">
          {!revealed ? (
            <button
              className="btn btn-primary flex-1 py-2.5"
              onClick={submit}
              disabled={selected === null}
            >
              정답 확인
            </button>
          ) : (
            <button className="btn btn-primary flex-1 py-2.5" onClick={next}>
              {idx + 1 === questions.length ? "결과 보기" : "다음 문항"} <ArrowRight size={16} />
            </button>
          )}
          <Link
            href={`/tutor?q=${q.id}`}
            className="btn btn-outline px-3 py-2.5"
            title="이 문항을 AI 튜터에게 질문"
          >
            <MessageCircleQuestion size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
}
