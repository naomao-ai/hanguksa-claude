"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { fetchFacts } from "@/lib/api";
import { ERAS, eraColor, eraLabel } from "@/lib/domain";
import { buildFactMap, resolveRelations, pushPath } from "@/lib/network";
import type { FactDTO } from "@/lib/types";
import { Loader2, Network as NetIcon, ArrowLeft, ArrowRight } from "lucide-react";

function yearLabel(y: number | null): string {
  if (y == null) return "";
  return y < 0 ? `BC ${-y}` : `${y}`;
}

function NetworkPage() {
  const params = useSearchParams();
  const initialFactId = params.get("factId");
  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [era, setEra] = useState<string>("");
  const [path, setPath] = useState<string[]>([]);

  useEffect(() => {
    fetchFacts().then((f) => { setFacts(f); setLoading(false); });
  }, []);
  useEffect(() => {
    if (initialFactId) setPath([initialFactId]);
  }, [initialFactId]);

  const factMap = useMemo(() => buildFactMap(facts), [facts]);
  const centerId = path[path.length - 1] ?? null;
  const center = centerId ? factMap.get(centerId) ?? null : null;
  const rel = useMemo(
    () => (center ? resolveRelations(center, factMap) : { prev: [], next: [] }),
    [center, factMap]
  );

  function go(id: string) { setPath((p) => pushPath(p, id)); }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><NetIcon className="text-primary" /> 사건 관계망</h1>
        <p className="text-muted">한 사건의 이전(배경·원인)·이후(결과·영향)를 따라 흐름을 탐색합니다.</p>
      </header>

      {!center ? (
        // 진입: 시대 선택 → 사건 목록
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {ERAS.map((e) => (
              <button key={e.key} onClick={() => setEra(e.key)}
                className={`rounded-full px-3 py-1.5 text-sm ${era === e.key ? "text-white" : "border bg-surface"}`}
                style={era === e.key ? { background: e.color } : undefined}>
                {e.label}
              </button>
            ))}
          </div>
          {era ? (
            <ul className="space-y-2">
              {facts.filter((f) => f.era === era).sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).map((f) => (
                <li key={f.id}>
                  <button onClick={() => setPath([f.id])} className="card flex w-full items-center gap-3 p-3 text-left hover:border-primary/40">
                    <span className="text-xs text-muted">{yearLabel(f.year)}</span>
                    <span className="font-semibold">{f.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card p-8 text-center text-muted">시대를 선택하면 사건 목록이 나옵니다.</div>
          )}
        </div>
      ) : (
        // 탐색 뷰: breadcrumb + 이전 | 현재 | 이후
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <button onClick={() => setPath([])} className="text-muted hover:text-foreground">시대 선택</button>
            {path.map((id, i) => {
              const f = factMap.get(id);
              return (
                <span key={id} className="flex items-center gap-1">
                  <span className="text-muted">/</span>
                  <button onClick={() => setPath(path.slice(0, i + 1))}
                    className={i === path.length - 1 ? "font-semibold text-primary" : "text-muted hover:text-foreground"}>
                    {f?.title ?? id}
                  </button>
                </span>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr]">
            <RelColumn title="이전 (배경·원인)" icon={<ArrowLeft size={14} />} items={rel.prev} onGo={go} align="end" />

            <div className="card border-primary/40 p-4">
              {center.category || center.importance || center.period ? (
                <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
                  {center.category && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-primary">{center.category}</span>}
                  {center.importance ? <span className="rounded-full bg-accent/12 px-2 py-0.5 text-accent">{"★".repeat(center.importance)}</span> : null}
                  {center.period && <span className="rounded-full bg-surface-2 px-2 py-0.5">{center.period}</span>}
                </div>
              ) : null}
              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: eraColor(center.era) }}>
                {eraLabel(center.era)} · {yearLabel(center.year)}
              </span>
              <h2 className="mt-2 text-xl font-bold">{center.title}</h2>
              <p className="mt-2 text-sm leading-relaxed">{center.body}</p>
              {(center.questionCount ?? 0) > 0 && (
                <a href={`/study?factId=${center.id}`} className="btn btn-primary mt-3 w-full py-2">관련 문제 {center.questionCount}개 풀기</a>
              )}
            </div>

            <RelColumn title="이후 (결과·영향)" icon={<ArrowRight size={14} />} items={rel.next} onGo={go} align="start" />
          </div>
        </div>
      )}
    </div>
  );
}

function RelColumn({ title, icon, items, onGo, align }: {
  title: string; icon: React.ReactNode; items: FactDTO[]; onGo: (id: string) => void; align: "start" | "end";
}) {
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-1 text-xs font-semibold text-muted ${align === "end" ? "md:justify-end" : ""}`}>
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <div className="card p-3 text-center text-xs text-muted">관계 없음</div>
      ) : (
        items.map((f) => (
          <button key={f.id} onClick={() => onGo(f.id)} className="card w-full p-3 text-left hover:border-primary/40">
            <span className="block text-xs text-muted">{yearLabel(f.year)}</span>
            <span className="block text-sm font-semibold">{f.title}</span>
            <span className="line-clamp-2 text-xs text-muted">{f.body}</span>
          </button>
        ))
      )}
    </div>
  );
}

export default function NetworkPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>}>
      <NetworkPage />
    </Suspense>
  );
}
