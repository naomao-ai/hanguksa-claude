"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchFacts } from "@/lib/api";
import { ERAS, eraColor, eraLabel } from "@/lib/domain";
import type { FactDTO } from "@/lib/types";
import { Loader2, GitBranch } from "lucide-react";

function yearLabel(y: number | null): string {
  if (y == null) return "";
  return y < 0 ? `BC ${-y}` : `${y}`;
}

/** 같은 era 안에서 period별로 묶어 정렬 순서를 유지한 그룹 배열 반환 */
function groupByPeriod(items: FactDTO[]): { period: string | null; rows: FactDTO[] }[] {
  const order: string[] = [];
  const map = new Map<string, FactDTO[]>();
  for (const f of items) {
    const key = f.period ?? "_none";
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(f);
  }
  return order.map((k) => ({ period: k === "_none" ? null : k, rows: map.get(k)! }));
}

export default function TimelinePage() {
  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<FactDTO | null>(null);

  useEffect(() => {
    fetchFacts().then((f) => {
      setFacts(f.sort((a, b) => (a.year ?? 0) - (b.year ?? 0)));
      setLoading(false);
    });
  }, []);

  // 시대별 그룹화 (정렬 순서 유지)
  const grouped = useMemo(() => {
    return ERAS.map((e) => ({
      era: e,
      items: facts.filter((f) => f.era === e.key),
    })).filter((g) => g.items.length > 0);
  }, [facts]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><GitBranch className="text-primary" /> 한국사 연표</h1>
        <p className="text-muted">시대 흐름을 한눈에. 사건을 눌러 상세 설명을 확인하세요.</p>
      </header>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted" /></div>
      ) : (
        <div className="no-scrollbar overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: "min-content" }}>
            {grouped.map(({ era, items }) => (
              <div key={era.key} className="w-64 shrink-0">
                <div
                  className="mb-3 rounded-lg px-3 py-2 text-center text-sm font-bold text-white"
                  style={{ background: era.color }}
                >
                  {era.label}
                </div>
                <div className="relative space-y-3 border-l-2 pl-4" style={{ borderColor: era.color }}>
                  {groupByPeriod(items).map(({ period, rows }) => (
                    <div key={period ?? "_"} className="space-y-2">
                      {period && <div className="text-xs font-semibold text-muted">{period}</div>}
                      {rows.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setActive(f)}
                          className="card relative w-full p-3 text-left hover:border-primary/40"
                        >
                          <span
                            className="absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full ring-2 ring-[var(--background)]"
                            style={{ background: era.color }}
                          />
                          <span className="block text-xs text-muted">{yearLabel(f.year)}</span>
                          <span className="block font-semibold">{f.title}</span>
                          {(f.questionCount ?? 0) > 0 && (
                            <span className="mt-0.5 inline-block rounded bg-primary/12 px-1.5 text-[10px] text-primary">문제 {f.questionCount}</span>
                          )}
                          <span className="line-clamp-2 text-xs text-muted">{f.body}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 상세 패널 */}
      {active && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setActive(null)}>
          <div className="card m-4 max-h-[82vh] w-full max-w-md overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <span
              className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ background: eraColor(active.era) }}
            >
              {eraLabel(active.era)} · {yearLabel(active.year)}
            </span>
            <h3 className="mb-2 text-xl font-bold">{active.title}</h3>
            <p className="mb-3 leading-relaxed">{active.body}</p>
            {active.detail.length > 0 && (
              <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="mb-1.5 text-xs font-semibold text-primary">상세 설명</p>
                <ul className="space-y-1">
                  {active.detail.map((d, i) => (
                    <li key={i} className="flex gap-1.5 text-sm leading-relaxed">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
              {active.category && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-primary">{active.category}</span>}
              {active.importance ? <span className="rounded-full bg-accent/12 px-2 py-0.5 text-accent">{"★".repeat(active.importance)}</span> : null}
              {active.period && <span className="rounded-full bg-surface-2 px-2 py-0.5">{active.period}</span>}
            </div>
            {active.relatedTo.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {active.relatedTo.map((r) => (
                  <span key={r} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{r}</span>
                ))}
              </div>
            )}
            {(active.questionCount ?? 0) > 0 && (
              <a href={`/study?factId=${active.id}`} className="btn btn-primary mt-3 w-full py-2">
                관련 문제 {active.questionCount}개 풀기
              </a>
            )}
            <a href={`/network?factId=${active.id}`} className="btn btn-outline mt-2 w-full py-2">
              이전·이후 관계 탐색
            </a>
            <button className="btn btn-ghost mt-2 w-full py-2" onClick={() => setActive(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
