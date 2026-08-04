"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Cell, ReferenceLine,
} from "recharts";
import { useStore } from "@/lib/useStore";
import { latestExam } from "@/lib/local-store";
import { ERAS, qTypeLabel } from "@/lib/domain";
import { pct } from "@/lib/utils";
import { AlertTriangle, TrendingUp, ClipboardCheck, Sparkles, Milestone } from "lucide-react";

interface Trends {
  total: number;
  byEra: Record<string, number>;
  byType: Record<string, number>;
  byDifficulty: Record<string, number>;
  byLevel: { SIMHWA: number; GIBON: number };
  byRound: { round: number; total: number; eras: Record<string, number> }[];
  avgDifficulty: number | null;
}

export default function AnalyticsPage() {
  const { store, ready } = useStore();
  const [trends, setTrends] = useState<Trends | null>(null);

  useEffect(() => {
    fetch("/api/analytics/trends").then((r) => r.json()).then(setTrends);
  }, []);

  // 개인 통계: 시대별 정답률
  const eraStats = useMemo(() => {
    const m: Record<string, { c: number; n: number }> = {};
    for (const a of store.attempts) {
      m[a.era] ??= { c: 0, n: 0 };
      m[a.era].n++;
      if (a.correct) m[a.era].c++;
    }
    return ERAS.filter((e) => m[e.key]).map((e) => ({
      key: e.key,
      label: e.label,
      acc: Math.round((m[e.key].c / m[e.key].n) * 100),
      n: m[e.key].n,
      color: e.color,
    }));
  }, [store.attempts]);

  // 정답률 추이 (날짜별)
  const trend = useMemo(() => {
    const byDay: Record<string, { c: number; n: number }> = {};
    for (const a of store.attempts) {
      const d = new Date(a.ts).toISOString().slice(5, 10);
      byDay[d] ??= { c: 0, n: 0 };
      byDay[d].n++;
      if (a.correct) byDay[d].c++;
    }
    return Object.entries(byDay).map(([day, v]) => ({ day, acc: Math.round((v.c / v.n) * 100) }));
  }, [store.attempts]);

  // 유형별 정답률 (개인)
  const typeStats = useMemo(() => {
    const m: Record<string, { c: number; n: number }> = {};
    for (const a of store.attempts) {
      m[a.qType] ??= { c: 0, n: 0 };
      m[a.qType].n++;
      if (a.correct) m[a.qType].c++;
    }
    return Object.entries(m).map(([key, v]) => ({
      label: qTypeLabel(key),
      acc: Math.round((v.c / v.n) * 100),
      n: v.n,
    }));
  }, [store.attempts]);

  const weak = useMemo(
    () => eraStats.filter((e) => e.n >= 3).sort((a, b) => a.acc - b.acc).slice(0, 3),
    [eraStats]
  );

  const total = store.attempts.length;
  const correct = store.attempts.filter((a) => a.correct).length;
  // 실전(모의고사) 기록만 분리 — 복습 반복으로 부풀려진 누적 정답률과 구분
  const examAttempts = store.attempts.filter((a) => a.source === "exam");
  const examCorrect = examAttempts.filter((a) => a.correct).length;

  // 모의고사 점수 추이
  const examTrend = useMemo(
    () =>
      store.examHistory.map((e) => ({
        day: new Date(e.ts).toISOString().slice(5, 10),
        score: e.score100,
      })),
    [store.examHistory]
  );
  const last = ready ? latestExam(store) : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">통계 · 출제경향</h1>
        <p className="text-muted">학습 데이터로 취약 영역을 진단하고 출제 경향을 파악합니다.</p>
      </header>

      {/* 개인 요약 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="총 풀이" value={`${total}`} />
        <Stat label="정답" value={`${correct}`} />
        <Stat label="누적 정답률" value={total ? pct(correct / total) : "—"} />
        <Stat label="실전 정답률(모의고사)" value={examAttempts.length ? pct(examCorrect / examAttempts.length) : "—"} />
        <Stat label="학습일" value={`${store.streak.studyDays.length}일`} />
      </section>

      {/* 모의고사 점수 추이 — "나 지금 합격권인가?" */}
      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 font-semibold"><ClipboardCheck size={18} /> 모의고사 점수 추이</h2>
          {last && (
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${last.passed ? "bg-green-500/12 text-green-600" : "bg-red-500/12 text-red-500"}`}>
              최근 {last.score100}점 — {last.passed ? `${last.grade}급 합격권` : "합격선(60점) 미달"}
            </span>
          )}
        </div>
        {examTrend.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">
            아직 모의고사 기록이 없습니다. <a href="/exam" className="font-medium text-primary">첫 모의고사</a>로 출발점을 확인하세요 — 이 그래프가 시험까지의 페이스를 알려줍니다.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={examTrend} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <ReferenceLine y={60} stroke="var(--accent)" strokeDasharray="4 4" label={{ value: "합격선 60", fontSize: 11, fill: "var(--accent)", position: "insideTopLeft" }} />
              <ReferenceLine y={80} stroke="var(--gold)" strokeDasharray="4 4" label={{ value: "1급 80", fontSize: 11, fill: "var(--gold)", position: "insideTopLeft" }} />
              <Line type="monotone" dataKey="score" name="점수" stroke="var(--primary)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* 취약 영역 진단 */}
      {weak.length > 0 && (
        <section className="card border-accent/30 p-4">
          <h2 className="mb-2 flex items-center gap-1.5 font-semibold"><AlertTriangle size={18} className="text-accent" /> 취약 영역 진단</h2>
          <ul className="space-y-1 text-sm">
            {weak.map((w) => (
              <li key={w.key} className="flex items-center justify-between">
                <span>{w.label}</span>
                <span className="font-medium text-accent">정답률 {w.acc}% ({w.n}문항)</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">위 영역을 집중 복습하면 점수 향상에 효과적입니다.</p>
        </section>
      )}

      {/* 시대별 정답률 */}
      {eraStats.length > 0 ? (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">시대별 정답률 (내 기록)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={eraStats} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="acc" name="정답률(%)" radius={[6, 6, 0, 0]}>
                {eraStats.map((e) => <Cell key={e.key} fill={e.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </section>
      ) : (
        <section className="card p-6 text-center text-muted">아직 학습 기록이 없습니다. 문제를 풀면 통계가 쌓입니다.</section>
      )}

      {/* 유형별 정답률 (개인) */}
      {typeStats.length > 0 && (
        <section className="card p-4">
          <h2 className="mb-3 font-semibold">유형별 정답률 (내 기록)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={typeStats} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Bar dataKey="acc" name="정답률(%)" fill="var(--accent)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* 정답률 추이 */}
      {trend.length > 1 && (
        <section className="card p-4">
          <h2 className="mb-3 flex items-center gap-1.5 font-semibold"><TrendingUp size={18} /> 일자별 정답률 추이</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "var(--muted)" }} />
              <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
              <Line type="monotone" dataKey="acc" name="정답률(%)" stroke="var(--primary)" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* 문제은행 출제경향 */}
      <section className="card p-4">
        <h2 className="mb-3 font-semibold">출제경향 — 문제은행 분포</h2>
        {!trends ? (
          <p className="text-sm text-muted">불러오는 중…</p>
        ) : trends.total === 0 ? (
          <p className="text-sm text-muted">문항이 없습니다.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-sm font-medium text-muted">시대별 출제 수</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ERAS.filter((e) => trends.byEra[e.key]).map((e) => ({ label: e.label, n: trends.byEra[e.key], color: e.color }))} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} width={70} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="n" name="문항" radius={[0, 6, 6, 0]}>
                    {ERAS.filter((e) => trends.byEra[e.key]).map((e) => <Cell key={e.key} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-muted">유형별 출제 수</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={Object.entries(trends.byType).map(([k, n]) => ({ label: qTypeLabel(k), n }))} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  <Bar dataKey="n" name="문항" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* 회차 커버리지 + 난이도 분포 */}
      {trends && trends.total > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">회차별 수록 문항</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trends.byRound.map((r) => ({ label: `${r.round}회`, n: r.total }))} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="n" name="문항" fill="var(--gold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-4">
            <h2 className="mb-1 font-semibold">난이도 분포</h2>
            <p className="mb-2 text-xs text-muted">평균 난이도 {trends.avgDifficulty ? trends.avgDifficulty.toFixed(1) : "—"} / 5</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[1, 2, 3, 4, 5].map((d) => ({ label: `${d}`, n: trends.byDifficulty?.[String(d)] ?? 0 }))} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="n" name="문항" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── 출제 흐름도 (문항 번호 기준 시대 매핑) ── */}
      {trends && trends.eraPositions && (
        <section className="card p-4">
          <h2 className="mb-2 flex items-center gap-1.5 font-semibold"><Milestone size={18} className="text-primary" /> 회차별 시대별 문항 분포 흐름</h2>
          <p className="mb-4 text-xs text-muted">과거 데이터 기반으로 각 시대의 문항이 주로 몇 번대에서 출제되는지 평균 구간을 보여줍니다.</p>
          <div className="space-y-3">
            {ERAS.filter(e => trends.eraPositions?.[e.key]).map(e => {
              const pos = trends.eraPositions![e.key];
              const leftPct = (pos.min / 50) * 100;
              const widthPct = ((pos.max - pos.min + 1) / 50) * 100;
              return (
                <div key={e.key} className="flex items-center gap-3 text-sm">
                  <div className="w-24 font-medium" style={{ color: e.color }}>{e.label}</div>
                  <div className="flex-1 h-6 bg-surface-2 rounded-full relative overflow-hidden">
                    <div 
                      className="absolute top-0 h-full rounded-full flex items-center justify-center text-[10px] text-slate-900 font-bold"
                      style={{ left: `${leftPct}%`, width: `${widthPct}%`, backgroundColor: e.color }}
                    >
                      {Math.round(pos.avg)}번 내외
                    </div>
                  </div>
                  <div className="w-16 text-right text-xs text-muted">{pos.min} ~ {pos.max}번</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 회차별 수록 문항 및 다음 차수 예측 (WMA) ── */}
      {trends && trends.predictedNextRound && (
        <section className="card p-4 border-2 border-accent/20 bg-accent/5">
          <h2 className="mb-2 flex items-center gap-1.5 font-semibold"><Sparkles size={18} className="text-accent" /> 다음 회차 출제 비중 예측</h2>
          <p className="mb-4 text-xs text-muted">최근 5회차의 가중 이동 평균(WMA)을 적용하여 차기 시험의 시대별 문항 수를 추정합니다.</p>
          
          <div className="grid gap-6 lg:grid-cols-3">
            {/* 예측 차트 영역 */}
            <div className="lg:col-span-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[
                  ...trends.byRound.slice(-5).map(r => ({ label: `${r.round}회`, ...r.eras, isPrediction: false })),
                  { label: `${trends.byRound[trends.byRound.length-1]?.round + 1}회 (예측)`, ...trends.predictedNextRound.eras, isPrediction: true }
                ]} margin={{ left: -20, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} interval={0} angle={-15} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                  {ERAS.map(e => (
                    <Bar key={e.key} dataKey={e.key} name={e.label} stackId="a" fill={e.color} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* 세부 주제 리스트 */}
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              <h3 className="text-sm font-bold border-b border-border pb-2">예상 주요 출제 키워드</h3>
              {ERAS.filter(e => trends.topTopics?.[e.key] && trends.topTopics[e.key].length > 0).map(e => (
                <div key={e.key} className="bg-surface p-2 rounded border border-border/50">
                  <div className="text-xs font-semibold mb-1" style={{ color: e.color }}>{e.label}</div>
                  <div className="flex flex-wrap gap-1">
                    {trends.topTopics![e.key].map(t => (
                      <span key={t.topic} className="px-2 py-0.5 bg-surface-2 border border-border rounded text-[10px] text-muted-foreground flex items-center gap-1">
                        {t.topic} <span className="opacity-50 text-[9px]">{t.count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* 회차 커버리지 + 난이도 분포 */}
      {trends && trends.total > 0 && (
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <h2 className="mb-3 font-semibold">회차별 수록 문항</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trends.byRound.map((r) => ({ label: `${r.round}회`, n: r.total }))} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted)" }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="n" name="문항" fill="var(--gold)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-4">
            <h2 className="mb-1 font-semibold">난이도 분포</h2>
            <p className="mb-2 text-xs text-muted">평균 난이도 {trends.avgDifficulty ? trends.avgDifficulty.toFixed(1) : "—"} / 5</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={[1, 2, 3, 4, 5].map((d) => ({ label: `${d}`, n: trends.byDifficulty?.[String(d)] ?? 0 }))} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                <Tooltip contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="n" name="문항" fill="var(--primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}
