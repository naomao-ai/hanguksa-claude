"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useStore } from "@/lib/useStore";
import { recordAttempt, toggleBookmark, type AttemptSource } from "@/lib/local-store";
import { eraLabel, qTypeLabel, levelLabel } from "@/lib/domain";
import { cn, pct } from "@/lib/utils";
import type { QuestionDTO } from "@/lib/types";
import { Bookmark, BookmarkCheck, CheckCircle2, XCircle, MessageCircleQuestion, ArrowRight, RotateCcw, Image as ImageIcon } from "lucide-react";
import ScrapBottomSheet from "@/components/ScrapBottomSheet";
import CorePoint from "@/components/CorePoint";

export default function StudyRunner({
  questions,
  source = "study",
  extraDoneActions,
}: {
  questions: QuestionDTO[];
  /** 풀이 맥락 — 통계에서 실전/복습 구분용 */
  source?: AttemptSource;
  /** 완료 화면에 추가로 렌더링할 액션(예: "다음 회차 이어가기") */
  extraDoneActions?: React.ReactNode;
}) {
  const { update, store } = useStore();
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [similarCount, setSimilarCount] = useState<number | null>(null);
  const [scrapTarget, setScrapTarget] = useState<{id: string, title: string} | null>(null);
  const [showImgDesc, setShowImgDesc] = useState(false);

  useEffect(() => {
    setShowImgDesc(false);
  }, [idx]);

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
        source,
        examRound: q.examRound ?? null,
      })
    );
  }

  function next() {
    setIdx((i) => i + 1);
    setSelected(null);
    setRevealed(false);
    setSimilarCount(null);
  }

  // 오답 reveal 시 유사 문제 개수 미리 조회
  useEffect(() => {
    if (!revealed || !q || selected === q.answerIndex) return;
    const sp = new URLSearchParams();
    if (q.factIds && q.factIds.length > 0) {
      sp.set("factId", q.factIds[0]);
    } else {
      sp.set("era", q.era);
    }
    sp.set("limit", "50");
    fetch(`/api/questions?${sp.toString()}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.questions) {
          const count = (data.questions as QuestionDTO[]).filter(x => x.id !== q.id).length;
          setSimilarCount(count);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed, q?.id, selected]);

  const handleSimilarQuestion = async () => {
    if (!q) return;
    setLoadingSimilar(true);
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
          window.location.href = `/study?q=${similar.id}`;
          return;
        }
      }
      alert("비슷한 유형의 문제를 찾지 못했습니다.");
    } catch (e) {
      alert("오류가 발생했습니다.");
    } finally {
      setLoadingSimilar(false);
    }
  };

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
    const wrongCount = results.length - correct;
    return (
      <div className="card p-8 text-center">
        <h2 className="mb-2 text-2xl font-bold">학습 완료 🎉</h2>
        <p className="mb-1 text-lg">
          {questions.length}문항 중 <b className="text-primary">{correct}문항</b> 정답
        </p>
        <p className="mb-6 text-muted">정답률 {pct(correct / questions.length)}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {/* 회차 정복 모드 등에서 주입하는 "다음 회차 이어가기" 액션 */}
          {extraDoneActions}
          {/* 틀린 직후가 복습 효과가 가장 클 때 — 오답이 있으면 바로 잇는다 */}
          {wrongCount > 0 && source !== "review" && (
            <Link href="/review" className="btn btn-accent px-4 py-2">
              오답 {wrongCount}개 이어서 복습 <ArrowRight size={16} />
            </Link>
          )}
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
          <Link
            href="/analytics"
            className={cn("btn px-4 py-2", wrongCount > 0 && source !== "review" ? "btn-outline" : "btn-primary")}
          >
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* 좌측: 사료 및 문제 영역 */}
        <div className="card p-5 sm:p-6 space-y-4 sticky top-4">
          {/* 메타 태그 */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="rounded bg-primary/12 px-2 py-0.5 font-medium text-primary">
              {levelLabel(q.level)}
            </span>
            <span className="rounded bg-surface-2 px-2 py-0.5">{eraLabel(q.era)}</span>
            <span className="rounded bg-surface-2 px-2 py-0.5">{qTypeLabel(q.qType)}</span>
            {q.examRound && (
              <span className="rounded bg-surface-2 px-2 py-0.5">{q.examRound}회</span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                onClick={() => setScrapTarget({ id: q.id, title: q.stem })}
                title="이 문제 수집하기"
              >
                🔖 수집
              </button>
              <button
                className="text-muted hover:text-accent"
                onClick={() => update((s) => toggleBookmark(s, q.id))}
                title="즐겨찾기"
              >
                {bookmarked ? <BookmarkCheck size={18} className="text-accent" /> : <Bookmark size={18} />}
              </button>
            </div>
          </div>

          {/* 발문 */}
          <p className="text-lg font-semibold leading-relaxed">{q.stem}</p>

          {/* 자료/사료 */}
          {q.passage && !q.imageUrl && (
            <blockquote className="rounded-lg border-l-4 border-gold bg-surface-2 p-3 text-sm leading-relaxed">
              {q.passage}
            </blockquote>
          )}
          {q.imageUrl && (
            <div className="relative group rounded-lg border overflow-hidden bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={q.imageUrl} 
                alt="자료" 
                className={cn("max-h-72 w-full object-contain", (q.imageDescription || q.passage) && "cursor-pointer")} 
                onClick={() => (q.imageDescription || q.passage) && setShowImgDesc(p => !p)} 
              />
              {(q.imageDescription || q.passage) && (
                <button
                  onClick={() => setShowImgDesc(p => !p)}
                  className="absolute bottom-2 right-2 bg-black/60 text-white p-1.5 rounded-md hover:bg-black/80 transition-colors flex items-center gap-1.5 text-xs shadow-md"
                  title="설명 보기"
                >
                  <ImageIcon size={14} /> 설명 보기
                </button>
              )}
              {(q.imageDescription || q.passage) && showImgDesc && (
                <div 
                  className="absolute inset-0 bg-black/85 text-white/95 p-5 overflow-y-auto text-sm leading-relaxed flex items-center justify-center cursor-pointer animate-in fade-in zoom-in-95 duration-200"
                  onClick={() => setShowImgDesc(false)}
                >
                  <div className="max-w-sm text-center flex flex-col items-center gap-3">
                    <div className="font-bold text-accent border-b border-white/20 pb-2 inline-block">[자료 설명]</div>
                    {q.passage && (
                      <div className="bg-white/10 rounded p-3 text-left w-full">
                        <p className="break-keep whitespace-pre-wrap">{q.passage}</p>
                      </div>
                    )}
                    {q.imageDescription && <p className="break-keep">{q.imageDescription}</p>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 우측: 선지 및 해설 영역 */}
        <div className="space-y-4">
          <div className="card p-5 sm:p-6">
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
                    <span className="flex flex-1 flex-col gap-1">
                      {c.text && <span>{c.text}</span>}
                      {c.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.imageUrl} alt={`선지 ${i + 1}`} className="max-h-40 rounded border" />
                      )}
                    </span>
                    {revealed && isAnswer && <CheckCircle2 size={18} className="text-green-600" />}
                    {revealed && isSelected && !isAnswer && <XCircle size={18} className="text-red-600" />}
                  </button>
                );
              })}
            </div>

            {/* 해설 및 유사 문제 */}
            {revealed && (
              <div className="mt-4 space-y-3">
                {q.corePoint && <CorePoint data={q.corePoint as any} />}
                {q.explanation && (
                  <div className="rounded-lg bg-surface-2 p-3 text-sm leading-relaxed">
                    <b className="text-primary">해설</b> · {q.explanation}
                  </div>
                )}
                {selected !== q.answerIndex && (
                  <div className="flex justify-end">
                    <button 
                      className="btn bg-accent/10 text-accent hover:bg-accent/20 px-3 py-1.5 text-xs font-medium"
                      onClick={handleSimilarQuestion}
                      disabled={loadingSimilar}
                    >
                      {loadingSimilar ? "로딩 중..." : `비슷한 유형 다시 풀기${similarCount != null && similarCount > 0 ? ` (${similarCount}문제)` : ""}`}
                    </button>
                  </div>
                )}
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
