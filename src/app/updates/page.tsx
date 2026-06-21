"use client";

import { useEffect, useState } from "react";
import { levelLabel } from "@/lib/domain";
import { Loader2, Info, Database, CalendarClock } from "lucide-react";

interface Release {
  id: string; version: number; title: string; notes: string;
  examRound: number | null; examLevel: string | null;
  questionCount: number; addedCount: number; publishedAt: string;
}
interface Data {
  current: { version: number; title: string; publishedAt: string } | null;
  meta: { total: number; simhwa: number; gibon: number; latestRound: number | null; updatedAt: string | null };
  releases: Release[];
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}
function levelText(l: string | null) {
  if (!l || l === "BOTH") return "심화+기본";
  return levelLabel(l as "SIMHWA" | "GIBON");
}

export default function UpdatesPage() {
  const [data, setData] = useState<Data | null>(null);

  const [error, setError] = useState(false);
  useEffect(() => {
    fetch("/api/releases")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="card p-8 text-center text-muted">업데이트 정보를 불러오지 못했습니다.</div>;
  if (!data) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Info className="text-primary" /> 업데이트 내역</h1>
        <p className="text-muted">문제은행 데이터의 버전·갱신 기준 정보입니다.</p>
      </header>

      {/* 현재 데이터셋 기준 정보 */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 font-semibold"><Database size={18} /> 현재 데이터셋</h2>
          {data.current && (
            <span className="rounded-full bg-primary/12 px-3 py-1 text-sm font-bold text-primary">v{data.current.version}</span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <Meta label="총 문항" value={`${data.meta.total}`} />
          <Meta label="심화 / 기본" value={`${data.meta.simhwa} / ${data.meta.gibon}`} />
          <Meta label="최근 반영 회차" value={data.meta.latestRound ? `${data.meta.latestRound}회` : "—"} />
          <Meta label="최종 업데이트" value={fmt(data.meta.updatedAt)} />
        </div>
      </section>

      {/* 변경 이력 */}
      <section className="space-y-3">
        <h2 className="font-semibold">변경 이력</h2>
        {data.releases.length === 0 ? (
          <p className="card p-6 text-center text-muted">아직 발행된 업데이트가 없습니다.</p>
        ) : (
          data.releases.map((r) => (
            <div key={r.id} className="card p-4">
              <div className="mb-1 flex items-center gap-2">
                <span className="rounded bg-primary/12 px-2 py-0.5 text-xs font-bold text-primary">v{r.version}</span>
                <h3 className="font-semibold">{r.title}</h3>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <CalendarClock size={13} /> {fmt(r.publishedAt)}
                {r.examRound ? ` · ${r.examRound}회(${levelText(r.examLevel)})` : ""}
                {r.addedCount ? ` · +${r.addedCount}문항` : ""}
                {` · 누적 ${r.questionCount}문항`}
              </p>
              {r.notes && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.notes}</p>}
            </div>
          ))
        )}
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-bold">{value}</p>
    </div>
  );
}
