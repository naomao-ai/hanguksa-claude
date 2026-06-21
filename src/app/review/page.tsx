"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/useStore";
import { dueQuestionIds, wrongQuestionIds } from "@/lib/local-store";
import { fetchQuestionsByIds } from "@/lib/api";
import type { QuestionDTO } from "@/lib/types";
import StudyRunner from "@/components/StudyRunner";
import { Loader2, CalendarClock, XCircle, Bookmark } from "lucide-react";

type Mode = "due" | "wrong" | "bookmark";

export default function ReviewPage() {
  const { store, ready } = useStore();
  const [mode, setMode] = useState<Mode | null>(null);
  const [questions, setQuestions] = useState<QuestionDTO[] | null>(null);
  const [loading, setLoading] = useState(false);

  const dueIds = ready ? dueQuestionIds(store) : [];
  const wrongIds = ready ? wrongQuestionIds(store) : [];
  const bookmarkIds = ready ? store.bookmarks : [];

  async function start(m: Mode) {
    setLoading(true);
    setMode(m);
    const ids = m === "due" ? dueIds : m === "wrong" ? wrongIds : bookmarkIds;
    setQuestions(await fetchQuestionsByIds(ids));
    setLoading(false);
  }

  if (questions && mode) {
    return (
      <div className="space-y-4">
        <button className="text-sm text-muted hover:text-foreground" onClick={() => { setQuestions(null); setMode(null); }}>
          ← 복습 메뉴로
        </button>
        <StudyRunner questions={questions} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">오답 · 복습</h1>
        <p className="text-muted">망각곡선 기반 간격반복(SRS)으로 약점을 정착시킵니다.</p>
      </header>

      {loading && <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted" /></div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <button
          onClick={() => dueIds.length && start("due")}
          disabled={!dueIds.length}
          className="card card-hover flex flex-col items-start gap-2 p-5 text-left disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[var(--shadow-sm)]"
        >
          <CalendarClock className="text-primary" />
          <span className="text-lg font-semibold">오늘 복습</span>
          <span className="text-sm text-muted">예정된 복습 {dueIds.length}문항</span>
        </button>

        <button
          onClick={() => wrongIds.length && start("wrong")}
          disabled={!wrongIds.length}
          className="card card-hover flex flex-col items-start gap-2 p-5 text-left disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[var(--shadow-sm)]"
        >
          <XCircle className="text-accent" />
          <span className="text-lg font-semibold">오답노트</span>
          <span className="text-sm text-muted">틀린 문항 {wrongIds.length}개</span>
        </button>

        <button
          onClick={() => bookmarkIds.length && start("bookmark")}
          disabled={!bookmarkIds.length}
          className="card card-hover flex flex-col items-start gap-2 p-5 text-left disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-[var(--shadow-sm)]"
        >
          <Bookmark className="text-gold" />
          <span className="text-lg font-semibold">즐겨찾기</span>
          <span className="text-sm text-muted">북마크 {bookmarkIds.length}문항</span>
        </button>
      </div>

      {ready && dueIds.length === 0 && wrongIds.length === 0 && bookmarkIds.length === 0 && (
        <p className="card p-6 text-center text-muted">
          아직 복습할 문항이 없습니다. <a href="/study" className="text-primary underline">문제풀이</a>로 학습을 시작하세요.
        </p>
      )}
    </div>
  );
}
