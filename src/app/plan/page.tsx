"use client";

import { useMemo, useRef } from "react";
import { useStore } from "@/lib/useStore";
import { useUI } from "@/components/ui/UIProvider";
import { ALL_BADGES } from "@/lib/local-store";
import { LEVELS, ERAS } from "@/lib/domain";
import { daysBetween } from "@/lib/utils";
import { CalendarRange, Flame, Trophy, Download, Upload, Target } from "lucide-react";

export default function PlanPage() {
  const { store, update, set, ready } = useStore();
  const { toast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);

  const dday = store.settings.examDate
    ? daysBetween(new Date(), new Date(store.settings.examDate))
    : null;

  // 취약 시대(정답률 낮은 순) 산출
  const weakEras = useMemo(() => {
    const m: Record<string, { c: number; n: number }> = {};
    for (const a of store.attempts) {
      m[a.era] ??= { c: 0, n: 0 };
      m[a.era].n++;
      if (a.correct) m[a.era].c++;
    }
    const scored = ERAS.map((e) => ({
      key: e.key,
      label: e.label,
      acc: m[e.key] ? m[e.key].c / m[e.key].n : -1, // 미학습 = 우선
      n: m[e.key]?.n ?? 0,
    }));
    return scored.sort((a, b) => a.acc - b.acc).slice(0, 4);
  }, [store.attempts]);

  // 일일 목표 (남은 일수로 역산)
  const dailyTarget = useMemo(() => {
    if (dday === null || dday <= 0) return 20;
    return Math.max(10, Math.ceil(50 / Math.min(dday, 30)) * 5);
  }, [dday]);

  function exportData() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hanguksa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        set(data);
        toast("학습 데이터를 가져왔습니다.", "success");
      } catch {
        toast("올바른 백업 파일이 아닙니다.", "error");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarRange className="text-primary" /> 학습 플랜</h1>
        <p className="text-muted">시험일과 목표를 설정하면 맞춤 커리큘럼을 제안합니다.</p>
      </header>

      {/* 목표 설정 */}
      <section className="card space-y-4 p-5">
        <h2 className="flex items-center gap-1.5 font-semibold"><Target size={18} /> 목표 설정</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-muted">시험일</span>
            <input
              type="date"
              value={store.settings.examDate ?? ""}
              onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, examDate: e.target.value || null } }))}
              className="w-full rounded-lg border bg-surface px-3 py-2"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">목표 등급</span>
            <select
              value={store.settings.targetLevel}
              onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, targetLevel: e.target.value as "SIMHWA" | "GIBON" } }))}
              className="w-full rounded-lg border bg-surface px-3 py-2"
            >
              {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label} ({l.sub})</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-muted">목표 급수</span>
            <select
              value={store.settings.targetGrade ?? ""}
              onChange={(e) => update((s) => ({ ...s, settings: { ...s.settings, targetGrade: e.target.value ? Number(e.target.value) : null } }))}
              className="w-full rounded-lg border bg-surface px-3 py-2"
            >
              {(store.settings.targetLevel === "SIMHWA" ? [1, 2, 3] : [4, 5, 6]).map((g) => (
                <option key={g} value={g}>{g}급</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {/* D-day 커리큘럼 */}
      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">맞춤 커리큘럼</h2>
          {dday !== null && (
            <span className="rounded-full bg-primary/12 px-3 py-1 text-sm font-bold text-primary">
              {dday >= 0 ? `D-${dday}` : "시험일 지남"}
            </span>
          )}
        </div>
        {dday === null ? (
          <p className="text-sm text-muted">시험일을 설정하면 일일 학습량과 집중 영역을 제안합니다.</p>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="font-medium">오늘의 목표</p>
              <ul className="ml-4 mt-1 list-disc space-y-0.5 text-muted">
                <li><b className="text-foreground">{dailyTarget}문항</b> 풀이 (시대 골고루)</li>
                <li>복습 큐 비우기 — <a href="/review" className="text-primary underline">오답·복습</a></li>
                <li>빈출 암기카드 10장 — <a href="/flashcards" className="text-primary underline">플래시카드</a></li>
              </ul>
            </div>
            <div className="rounded-lg bg-surface-2 p-3">
              <p className="mb-1 font-medium">집중 영역 (취약/미학습 우선)</p>
              <div className="flex flex-wrap gap-1.5">
                {weakEras.map((w) => (
                  <a key={w.key} href={`/study`} className="rounded-full bg-accent/12 px-2.5 py-1 text-xs text-accent">
                    {w.label}{w.n === 0 ? " (미학습)" : ` (${Math.round(w.acc * 100)}%)`}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 스트릭 + 배지 */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-2 flex items-center gap-1.5 font-semibold"><Flame size={18} className="text-accent" /> 연속 학습</h2>
          <p className="text-3xl font-extrabold text-accent">{ready ? store.streak.current : 0}일</p>
          <p className="text-sm text-muted">최고 기록 {store.streak.longest}일 · 총 {store.streak.studyDays.length}일 학습</p>
        </div>
        <div className="card p-5">
          <h2 className="mb-2 flex items-center gap-1.5 font-semibold"><Trophy size={18} className="text-gold" /> 배지</h2>
          <div className="flex flex-wrap gap-1.5">
            {ALL_BADGES.map((b) => {
              const earned = store.badges.includes(b.id);
              return (
                <span
                  key={b.id}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${earned ? "bg-gold/15 text-gold" : "bg-surface-2 text-muted opacity-60"}`}
                >
                  {earned ? "🏅 " : ""}{b.label}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* 데이터 백업 */}
      <section className="card p-5">
        <h2 className="mb-2 font-semibold">데이터 백업</h2>
        <p className="mb-3 text-sm text-muted">학습 기록은 이 기기에만 저장됩니다. 다른 기기로 옮기려면 내보내기/가져오기를 사용하세요.</p>
        <div className="flex gap-2">
          <button className="btn btn-outline px-4 py-2" onClick={exportData}><Download size={16} /> 내보내기</button>
          <button className="btn btn-outline px-4 py-2" onClick={() => fileRef.current?.click()}><Upload size={16} /> 가져오기</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importData} />
        </div>
      </section>
    </div>
  );
}
