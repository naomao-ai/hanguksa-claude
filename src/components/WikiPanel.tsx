"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import type { FactDTO, QuestionDTO } from "@/lib/types";
import { fetchQuestions } from "@/lib/api";
import { eraColor, eraLabel } from "@/lib/domain";

interface WikiPanelProps {
  fact: FactDTO;
  factMap: Map<string, FactDTO>;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onKeywordClick: (kw: string) => void;
}

export default function WikiPanel({ fact, factMap, onClose, onNavigate, onKeywordClick }: WikiPanelProps) {
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchQuestions({ factId: fact.id })
      .then((res) => {
        setQuestions(res);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [fact.id]);

  const prevFacts = useMemo(() => fact.prevFactIds.map((id) => factMap.get(id)).filter((f): f is FactDTO => !!f), [fact.prevFactIds, factMap]);
  const nextFacts = useMemo(() => fact.nextFactIds.map((id) => factMap.get(id)).filter((f): f is FactDTO => !!f), [fact.nextFactIds, factMap]);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface p-6 shadow-xl border-l">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full px-2 py-0.5 text-white font-medium" style={{ background: eraColor(fact.era) }}>
            {eraLabel(fact.era)} {fact.year ? `· ${fact.year > 0 ? fact.year : `BC ${-fact.year}`}` : ""}
          </span>
          {fact.category && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-primary">{fact.category}</span>}
          {fact.importance ? <span className="rounded-full bg-accent/12 px-2 py-0.5 text-accent">{"★".repeat(fact.importance)}</span> : null}
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground">
          <X size={20} />
        </button>
      </div>

      <h2 className="mt-4 text-2xl font-bold">{fact.title}</h2>

      {/* Body & Details */}
      <div className="mt-4 space-y-3 border-b border-border/50 pb-6">
        <p className="leading-relaxed text-sm">{fact.body}</p>
        {fact.detail?.length > 0 && (
          <ul className="list-inside list-disc space-y-1 text-sm text-muted">
            {fact.detail.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Timeline (인과관계) */}
      {(prevFacts.length > 0 || nextFacts.length > 0) && (
        <div className="mt-6 border-b border-border/50 pb-6">
          <h3 className="mb-3 font-semibold flex items-center gap-2">
            <ArrowRight size={16} className="text-primary" /> 사건의 흐름
          </h3>
          <div className="space-y-3">
            {prevFacts.length > 0 && (
              <div className="pl-2 border-l-2 border-border ml-2 space-y-2">
                <div className="text-xs text-muted">배경 · 원인</div>
                {prevFacts.map(f => (
                  <button key={f.id} onClick={() => onNavigate(f.id)} className="block text-left text-sm hover:text-primary">
                    {f.title}
                  </button>
                ))}
              </div>
            )}
            <div className="pl-2 border-l-2 border-primary ml-2 py-1 font-medium">
              {fact.title}
            </div>
            {nextFacts.length > 0 && (
              <div className="pl-2 border-l-2 border-border ml-2 space-y-2">
                <div className="text-xs text-muted">결과 · 영향</div>
                {nextFacts.map(f => (
                  <button key={f.id} onClick={() => onNavigate(f.id)} className="block text-left text-sm hover:text-primary">
                    {f.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Keywords */}
      {fact.keywords?.length > 0 && (
        <div className="mt-6 border-b border-border/50 pb-6">
          <h3 className="mb-3 font-semibold">관련 키워드</h3>
          <div className="flex flex-wrap gap-2">
            {fact.keywords.map((kw) => (
              <button 
                key={kw} 
                onClick={() => onKeywordClick(kw)}
                className="rounded-full bg-surface-2 px-3 py-1 text-xs hover:bg-primary/20 hover:text-primary transition-colors"
              >
                # {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Related Questions */}
      <div className="mt-6 pb-6">
        <h3 className="mb-3 font-semibold flex items-center justify-between">
          <span>기출 문제 ({fact.questionCount || 0})</span>
          {(fact.questionCount || 0) > 0 && (
            <a href={`/study?factId=${fact.id}`} className="text-xs text-primary hover:underline">
              모두 풀기
            </a>
          )}
        </h3>
        {loading ? (
          <div className="text-sm text-muted">불러오는 중...</div>
        ) : questions.length === 0 ? (
          <div className="text-sm text-muted">연결된 기출문제가 없습니다.</div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => (
              <div key={q.id} className="card p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-medium text-foreground">{q.examRound}회 {q.level === "SIMHWA" ? "심화" : "기본"} {q.number}번</span>
                </div>
                <div className="text-sm font-medium line-clamp-2">{q.stem}</div>
                {q.wikiMeta && (
                  <div className="mt-2 rounded bg-primary/5 p-2 text-xs">
                    <div className="font-semibold text-primary mb-1">💡 학습 팁</div>
                    <div>{q.wikiMeta.studyTip}</div>
                  </div>
                )}
                <a href={`/study?factId=${fact.id}`} className="btn btn-primary mt-2 w-full py-1.5 text-xs">
                  문제 풀기
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
