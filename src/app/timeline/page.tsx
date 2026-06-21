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
                <div className="relative space-y-2 border-l-2 pl-4" style={{ borderColor: era.color }}>
                  {items.map((f) => (
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
                      <span className="line-clamp-2 text-xs text-muted">{f.body}</span>
                    </button>
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
          <div className="card m-4 w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <span
              className="mb-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ background: eraColor(active.era) }}
            >
              {eraLabel(active.era)} · {yearLabel(active.year)}
            </span>
            <h3 className="mb-2 text-xl font-bold">{active.title}</h3>
            <p className="mb-3 leading-relaxed">{active.body}</p>
            {active.relatedTo.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {active.relatedTo.map((r) => (
                  <span key={r} className="rounded-full bg-surface-2 px-2 py-0.5 text-xs">{r}</span>
                ))}
              </div>
            )}
            <button className="btn btn-primary mt-4 w-full py-2" onClick={() => setActive(null)}>닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}
