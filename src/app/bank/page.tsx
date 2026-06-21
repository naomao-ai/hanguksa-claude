"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ERAS, eraLabel, qTypeLabel, levelLabel } from "@/lib/domain";
import { fetchQuestions, fetchRounds } from "@/lib/api";
import type { QuestionDTO } from "@/lib/types";
import { Loader2, FileText, Info, Search, ChevronDown, CheckCircle2 } from "lucide-react";

// 공개 열람 전용 문제은행 (쓰기는 /admin 에서 관리자만)
export default function BankPage() {
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [rounds, setRounds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [era, setEra] = useState("");
  const [level, setLevel] = useState("");
  const [round, setRound] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { fetchRounds().then(setRounds); }, []);

  // 검색어 디바운스
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setQuestions(await fetchQuestions({ era: era || undefined, level: level || undefined, round: round || undefined, q: q || undefined, limit: 300 }));
    setLoading(false);
  }, [era, level, round, q]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><FileText className="text-primary" /> 문제은행</h1>
          <p className="text-muted">수록된 기출 문항을 열람합니다. 데이터는 관리자가 주기적으로 갱신합니다.</p>
        </div>
        <Link href="/updates" className="btn btn-outline px-3 py-2 text-sm"><Info size={15} /> 업데이트 내역</Link>
      </header>

      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="키워드 검색 (발문·인물·사료)"
          className="w-full rounded-lg border bg-surface py-2.5 pl-9 pr-3 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded-lg border bg-surface px-3 py-1.5 text-sm">
          <option value="">전체 등급</option>
          <option value="SIMHWA">심화</option>
          <option value="GIBON">기본</option>
        </select>
        <select value={era} onChange={(e) => setEra(e.target.value)} className="rounded-lg border bg-surface px-3 py-1.5 text-sm">
          <option value="">전체 시대</option>
          {ERAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
        <select value={round} onChange={(e) => setRound(e.target.value)} className="rounded-lg border bg-surface px-3 py-1.5 text-sm">
          <option value="">전체 회차</option>
          {rounds.map((r) => <option key={r} value={r}>{r}회</option>)}
        </select>
        <span className="text-sm text-muted">{questions.length}문항</span>
        <Link href="/study" className="btn btn-primary ml-auto px-3 py-1.5 text-sm">이 조건으로 학습</Link>
      </div>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted" /></div>
      ) : questions.length === 0 ? (
        <div className="card p-8 text-center text-muted">표시할 문항이 없습니다.</div>
      ) : (
        <ul className="space-y-2">
          {questions.map((q) => {
            const open = expanded === q.id;
            return (
              <li key={q.id} className="card overflow-hidden">
                <button
                  className="flex w-full items-start gap-3 p-4 text-left"
                  onClick={() => setExpanded(open ? null : q.id)}
                  aria-expanded={open}
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap gap-1 text-xs">
                      <Tag>{levelLabel(q.level)}</Tag>
                      <Tag>{eraLabel(q.era)}</Tag>
                      <Tag>{qTypeLabel(q.qType)}</Tag>
                      {q.examRound && <Tag>{q.examRound}회</Tag>}
                      {q.difficulty && <Tag>난이도 {q.difficulty}</Tag>}
                    </div>
                    <p className={open ? "text-sm font-medium" : "line-clamp-2 text-sm"}>{q.stem}</p>
                  </div>
                  <ChevronDown size={18} className={`mt-0.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                {open && (
                  <div className="animate-in border-t px-4 pb-4 pt-3 text-sm">
                    {q.passage && (
                      <blockquote className="mb-3 rounded-lg border-l-4 border-gold bg-surface-2 p-3 leading-relaxed text-muted">
                        {q.passage}
                      </blockquote>
                    )}
                    {q.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={q.imageUrl} alt="문항 자료" className="mb-3 max-h-80 rounded-lg border" />
                    )}
                    <ol className="space-y-1.5">
                      {q.choices.map((c, i) => {
                        const correct = i === q.answerIndex;
                        return (
                          <li key={c.id} className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${correct ? "bg-green-500/10" : ""}`}>
                            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border text-xs font-bold ${correct ? "border-green-500 text-green-600" : "border-border text-muted"}`}>{i + 1}</span>
                            <span className={correct ? "font-medium" : ""}>{c.text}</span>
                            {correct && <CheckCircle2 size={15} className="ml-auto mt-0.5 shrink-0 text-green-600" />}
                          </li>
                        );
                      })}
                    </ol>
                    {q.explanation && (
                      <div className="mt-3 rounded-lg bg-surface-2 p-3 leading-relaxed">
                        <b className="text-primary">해설</b> · {q.explanation}
                      </div>
                    )}
                    {q.topics.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {q.topics.map((t) => <Tag key={t} accent>{t}</Tag>)}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Tag({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <span className={`rounded px-1.5 py-0.5 ${accent ? "bg-accent/12 text-accent" : "bg-surface-2"}`}>{children}</span>
  );
}
