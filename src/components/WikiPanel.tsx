"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, ArrowRight, X, Flame, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import type { FactDTO, QuestionDTO } from "@/lib/types";
import { fetchQuestions } from "@/lib/api";
import { eraColor, eraLabel } from "@/lib/domain";
import HighlightedText from "@/components/HighlightedText";
import { loadStore, wrongQuestionIds } from "@/lib/local-store";
import Link from "next/link";

/** 인과체인 항목의 핵심 요약(1~2줄). 의의(significance) 우선, 없으면 본문 첫 문장. */
function causalSummary(f: FactDTO): string {
  const src = (f.significance || f.body || "").replace(/\s+/g, " ").trim();
  if (!src) return "";
  // 첫 1~2문장만 추려 최대 90자
  const sentences = src.split(/(?<=[.。!?])\s/).slice(0, 2).join(" ");
  const out = sentences || src;
  return out.length > 90 ? out.slice(0, 89).trimEnd() + "…" : out;
}

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
  const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // 로컬 스토어에서 틀린 문제 목록 가져오기 (학습 상태 파악)
    const store = loadStore();
    setWrongIds(new Set(wrongQuestionIds(store)));
  }, [fact.id]);

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

  // 학습 인사이트 계산
  const totalQ = questions.length;
  const wrongQCount = questions.filter(q => wrongIds.has(q.id)).length;
  const isHighFreq = (fact.questionCount || 0) >= 3 || fact.importance === 3;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-slate-800 p-6 shadow-2xl border-l-4 border-primary/40 relative z-50">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full px-2 py-0.5 text-slate-900 font-bold tracking-wide shadow-sm" style={{ background: eraColor(fact.era) }}>
            {eraLabel(fact.era)} {fact.year ? `· ${fact.year > 0 ? fact.year : `BC ${-fact.year}`}` : ""}
          </span>
          {fact.category && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-primary-fg font-medium shadow-sm">{fact.category}</span>}
        </div>
        <button onClick={onClose} className="text-muted hover:text-foreground p-1 transition-colors bg-surface-2 rounded-full hover:bg-surface-3">
          <X size={20} />
        </button>
      </div>

      <h2 className="mt-4 text-3xl font-extrabold tracking-tight bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent pb-1">{fact.title}</h2>

      {/* ── Phase D: 학습 전략 인사이트 ── */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className={`p-3 rounded-lg border ${isHighFreq ? 'bg-amber-500/10 border-amber-500/20' : 'bg-surface-2 border-border'}`}>
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-1">
            {isHighFreq ? <Flame size={16} className="text-amber-500" /> : <CheckCircle2 size={16} className="text-muted" />}
            <span>출제 빈도</span>
          </div>
          <div className="text-2xl font-bold">
            {fact.questionCount || 0}<span className="text-sm font-normal text-muted ml-1">회 출제</span>
          </div>
          {isHighFreq && <div className="text-xs text-amber-600 mt-1">빈출 핵심 사건입니다!</div>}
        </div>

        <div className={`p-3 rounded-lg border ${wrongQCount > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-surface-2 border-border'}`}>
          <div className="flex items-center gap-1.5 text-sm font-semibold mb-1">
            {wrongQCount > 0 ? <AlertCircle size={16} className="text-red-500" /> : <CheckCircle2 size={16} className="text-green-500" />}
            <span>나의 정복도</span>
          </div>
          <div className="text-2xl font-bold">
            {totalQ > 0 ? `${totalQ - wrongQCount}/${totalQ}` : "-"}
            <span className="text-sm font-normal text-muted ml-1">정답</span>
          </div>
          {wrongQCount > 0 && <div className="text-xs text-red-600 mt-1">틀린 문제가 {wrongQCount}개 있습니다.</div>}
        </div>
      </div>

      {/* Body & Significance & Details */}
      <div className="mt-5 space-y-4 border-b border-border/50 pb-6">
        {fact.body && (
          <div className="leading-relaxed text-sm font-medium text-foreground/90 bg-surface-2 p-3.5 rounded-lg border border-border/50 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary/40"></div>
            {fact.body}
          </div>
        )}
        
        {fact.significance && (
          <div className="leading-relaxed text-sm text-foreground/80 bg-blue-500/5 p-3.5 rounded-lg border border-blue-500/20 relative">
            <div className="font-bold text-blue-600 mb-1 flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
              평가 및 의의
            </div>
            {fact.significance}
          </div>
        )}
        
        {fact.detail && fact.detail.length > 0 && (
          <div className="rounded-lg border border-border overflow-hidden bg-background">
            <button 
              onClick={() => setDetailOpen(!detailOpen)}
              className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-surface-2 transition-colors"
            >
              상세 설명 펼치기
              {detailOpen ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
            </button>
            {detailOpen && (
              <div className="p-4 pt-0 border-t border-border">
                <ul className="list-disc list-outside ml-4 space-y-2.5 text-sm marker:text-muted">
                  {fact.detail.map((d, i) => (
                    <li key={`detail-${i}`} className="leading-relaxed">
                      <HighlightedText text={d} keywords={fact.keywords} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Phase C: Timeline (인과관계 경로 탐색) ── */}
      {(prevFacts.length > 0 || nextFacts.length > 0) && (
        <div className="mt-6 border-b border-border/50 pb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ArrowRight size={16} className="text-primary" /> 인과 체인 (사건의 흐름)
            </h3>
            <span className="text-xs text-muted">노드를 클릭해 이동하세요</span>
          </div>
          
          <div className="space-y-0 text-sm">
            {/* 원인 */}
            {prevFacts.map((f, i) => (
              <div key={f.id} className="relative pl-6 pb-4">
                <div className="absolute left-2 top-1.5 w-2 h-2 rounded-full bg-border" />
                <div className="absolute left-2.5 top-3.5 w-0.5 h-full bg-border -translate-x-1/2" />
                <div className="text-xs text-muted font-medium mb-0.5">배경 · 원인</div>
                <button onClick={() => onNavigate(f.id)} className="text-left font-medium hover:text-primary transition-colors">
                  {f.title}
                </button>
                {(f.significance || f.body) && (
                  <p className="mt-0.5 text-xs text-muted leading-relaxed line-clamp-2">
                    {causalSummary(f)}
                  </p>
                )}
              </div>
            ))}
            
            {/* 현재 사건 */}
            <div className="relative pl-6 pb-4">
              <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-primary shadow-[0_0_0_3px_rgba(var(--primary),0.2)]" />
              {nextFacts.length > 0 && <div className="absolute left-2.5 top-4 w-0.5 h-full bg-border -translate-x-1/2" />}
              <div className="font-bold text-primary text-base">{fact.title}</div>
            </div>

            {/* 결과 */}
            {nextFacts.map((f, i) => (
              <div key={f.id} className="relative pl-6 pb-4">
                <div className="absolute left-2 top-1.5 w-2 h-2 rounded-full bg-border" />
                {i < nextFacts.length - 1 && <div className="absolute left-2.5 top-3.5 w-0.5 h-full bg-border -translate-x-1/2" />}
                <div className="text-xs text-muted font-medium mb-0.5">결과 · 영향</div>
                <button onClick={() => onNavigate(f.id)} className="text-left font-medium hover:text-primary transition-colors">
                  {f.title}
                </button>
                {(f.significance || f.body) && (
                  <p className="mt-0.5 text-xs text-muted leading-relaxed line-clamp-2">
                    {causalSummary(f)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keywords */}
      {fact.keywords?.length > 0 && (
        <div className="mt-6 border-b border-border/50 pb-6">
          <h3 className="mb-3 font-semibold text-sm">핵심 키워드</h3>
          <div className="flex flex-wrap gap-2">
            {fact.keywords.map((kw) => (
              <button 
                key={kw} 
                onClick={() => onKeywordClick(kw)}
                className="rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors border border-border"
              >
                # {kw}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Related Questions */}
      <div className="mt-6 pb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">연결된 기출문제 ({questions.length})</h3>
          {questions.length > 0 && (
            <Link href={`/study?factId=${fact.id}`} className="text-xs bg-primary/10 text-primary font-medium px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors">
              문제 풀러가기
            </Link>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            기출문제 불러오는 중...
          </div>
        ) : questions.length === 0 ? (
          <div className="text-sm text-muted bg-surface-2 p-4 rounded-lg text-center">
            아직 이 사건과 직접 연결된 기출문제가 없습니다.
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q) => {
              const isWrong = wrongIds.has(q.id);
              const selectedIdx = selectedAnswers[q.id];
              const isSolved = selectedIdx !== undefined;
              const isCorrect = isSolved && selectedIdx === q.answerIndex;
              const showExp = showExplanation[q.id];
              
              return (
                <div key={q.id} className={`p-4 rounded-xl border transition-colors ${isWrong ? 'bg-red-500/5 border-red-500/20' : 'bg-surface-2 border-border'}`}>
                  <div className="flex items-center justify-between gap-2 text-xs mb-2">
                    <span className="font-semibold text-primary">
                      {q.examRound}회 {q.level === "SIMHWA" ? "심화" : "기본"} {q.number}번
                    </span>
                    <div className="flex gap-2">
                      {isWrong && <span className="bg-red-500/10 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold">오답 이력</span>}
                      {isSolved && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                          {isCorrect ? '정답' : '오답'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-sm font-medium leading-snug mb-3 text-foreground/90">{q.stem}</div>

                  {/* 문항 자료 이미지 */}
                  {q.imageUrl && (
                    <img
                      src={q.imageUrl}
                      alt={q.imageDescription || "문항 자료"}
                      loading="lazy"
                      className="mb-3 w-full max-h-72 object-contain rounded-lg border border-border bg-white"
                    />
                  )}

                  {/* 선택지 목록 */}
                  <div className="space-y-2 mb-3">
                    {q.choices.map((choice, i) => {
                      const isSelected = selectedIdx === i;
                      const isActualAnswer = isSolved && i === q.answerIndex;
                      const isWrongSelection = isSolved && isSelected && i !== q.answerIndex;
                      
                      let choiceClass = "border-border bg-background hover:border-primary/50 cursor-pointer";
                      if (isActualAnswer) choiceClass = "border-green-500 bg-green-500/10 font-medium text-green-700";
                      else if (isWrongSelection) choiceClass = "border-red-500 bg-red-500/10 text-red-700";
                      else if (isSolved) choiceClass = "border-border bg-background opacity-50 cursor-default";
                      
                      return (
                        <button
                          key={choice.id}
                          disabled={isSolved}
                          onClick={() => {
                            setSelectedAnswers(prev => ({ ...prev, [q.id]: i }));
                            setShowExplanation(prev => ({ ...prev, [q.id]: true }));
                          }}
                          className={`w-full text-left p-2 rounded-lg border text-sm transition-all ${choiceClass} flex gap-2 items-start`}
                        >
                          <span className="font-bold flex-shrink-0 w-4">{i + 1}.</span>
                          <span className="flex-1">
                            {choice.text}
                            {choice.imageUrl && (
                              <img
                                src={choice.imageUrl}
                                alt={`선택지 ${i + 1}`}
                                loading="lazy"
                                className="mt-1 max-h-40 object-contain rounded border border-border bg-white"
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  
                  {showExp && (
                    <div className="mt-3 rounded-lg bg-background p-3 text-xs border border-border/50 animate-in fade-in slide-in-from-top-2">
                      {q.wikiMeta && (
                        <div className="mb-2">
                          <div className="font-bold text-amber-600 mb-1 flex items-center gap-1">
                            <Flame size={12} /> 출제 포인트
                          </div>
                          <div className="text-muted leading-relaxed">{q.wikiMeta.studyTip}</div>
                        </div>
                      )}
                      {q.explanation && (
                        <div>
                          <div className="font-bold text-slate-700 mb-1">해설</div>
                          <div className="text-muted leading-relaxed whitespace-pre-line">{q.explanation}</div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {!isSolved && (
                    <Link href={`/study?factId=${fact.id}`} className="mt-2 text-[10px] text-muted hover:text-primary transition-colors block text-center">
                      상세 해설 모드로 보기 →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
