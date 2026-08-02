"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LEVELS, eraLabel, type Level } from "@/lib/domain";
import { fetchRounds, fetchRoundStats, fetchQuestions, type RoundStat } from "@/lib/api";
import { useStore } from "@/lib/useStore";
import { roundAttemptCounts, nextTargetRound, weakErasFromRound } from "@/lib/local-store";
import type { QuestionDTO } from "@/lib/types";
import StudyRunner from "@/components/StudyRunner";
import Chips from "@/components/Chips";
import { Loader2, Trophy, CheckCircle2, CircleDashed, PlayCircle, ArrowRight, Target } from "lucide-react";

type Status = "완료" | "진행중" | "미착수";

interface RoundRow {
  round: number;
  total: number;
  attempted: number;
  status: Status;
}

export default function RoundsPage() {
  const { store, ready } = useStore();
  const [level, setLevel] = useState<Level>("SIMHWA");
  const [rounds, setRounds] = useState<number[]>([]);
  const [stats, setStats] = useState<RoundStat[]>([]);
  const [loaded, setLoaded] = useState(false);

  // 실행 상태
  const [running, setRunning] = useState(false);
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [boostEras, setBoostEras] = useState<string[]>([]);
  const [runKey, setRunKey] = useState(0);
  const [loadingRun, setLoadingRun] = useState(false);

  useEffect(() => {
    Promise.all([fetchRounds(), fetchRoundStats()]).then(([r, s]) => {
      setRounds(r);
      setStats(s);
      setLoaded(true);
    });
  }, []);

  const totalForRound = useCallback(
    (round: number) => {
      const s = stats.find((x) => x.round === round);
      if (!s) return 0;
      return level === "SIMHWA" ? s.simhwa : s.gibon;
    },
    [stats, level]
  );

  // 회차별 진행 현황 (해당 등급에 문항이 있는 회차만, 높은순)
  const rows = useMemo<RoundRow[]>(() => {
    if (!ready) return [];
    const counts = roundAttemptCounts(store, level);
    return rounds
      .map((round) => {
        const total = totalForRound(round);
        const attempted = Math.min(counts[round] ?? 0, total);
        const status: Status = total > 0 && attempted >= total ? "완료" : attempted > 0 ? "진행중" : "미착수";
        return { round, total, attempted, status };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.round - a.round);
  }, [ready, store, rounds, level, totalForRound]);

  const completed = useMemo(
    () => new Set(rows.filter((r) => r.status === "완료").map((r) => r.round)),
    [rows]
  );
  const availableRounds = useMemo(() => rows.map((r) => r.round), [rows]);
  const target = useMemo(() => nextTargetRound(availableRounds, completed), [availableRounds, completed]);

  const startRound = useCallback(
    async (round: number, boost: string[] = []) => {
      setLoadingRun(true);
      setBoostEras(boost);
      const qs = await fetchQuestions({ level, round: String(round), limit: 60 });
      // 유사문제 집중: 이전 회차 취약 시대에 해당하는 문항을 앞쪽으로 (그룹 내 번호순 유지)
      const ordered =
        boost.length > 0
          ? [...qs].sort((a, b) => (boost.includes(a.era) ? 0 : 1) - (boost.includes(b.era) ? 0 : 1))
          : qs;
      setQuestions(ordered);
      setActiveRound(round);
      setRunKey((k) => k + 1);
      setRunning(true);
      setLoadingRun(false);
    },
    [level]
  );

  const levelLabel = LEVELS.find((l) => l.value === level)?.label ?? "";

  // ── 실행 화면 ───────────────────────────────────────────────
  if (running && activeRound != null) {
    // 이번 회차를 마친 뒤 이어갈 다음 회차 (현재 회차 제외, 완료분 제외 후 최고 회차)
    const nextRound = nextTargetRound(
      availableRounds.filter((r) => r !== activeRound),
      completed
    );
    const nextBtn = nextRound != null ? (
      <button
        className="btn btn-primary px-4 py-2"
        onClick={() => startRound(nextRound, weakErasFromRound(store, activeRound, level))}
      >
        다음 {nextRound}회 이어가기 · 유사문제 집중 <ArrowRight size={16} />
      </button>
    ) : (
      <Link href="/rounds" className="btn btn-primary px-4 py-2" onClick={() => setRunning(false)}>
        모든 회차 완료 🎉
      </Link>
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            🏆 <b className="text-foreground">{activeRound}회 {levelLabel}</b> 정복 중 · {questions.length}문항
            {boostEras.length > 0 && (
              <>
                {" "}· 이전 회차 취약 시대{" "}
                <b className="text-accent">{boostEras.map(eraLabel).join("·")}</b> 유사문제를 앞쪽에 배치
              </>
            )}
          </p>
          <button className="text-sm text-muted hover:text-foreground" onClick={() => setRunning(false)}>
            ← 회차 목록
          </button>
        </div>
        {questions.length === 0 ? (
          <div className="card p-8 text-center text-muted">이 회차의 문항을 불러오지 못했습니다.</div>
        ) : (
          <StudyRunner key={runKey} questions={questions} source="study" extraDoneActions={nextBtn} />
        )}
      </div>
    );
  }

  // ── 개요 화면 ───────────────────────────────────────────────
  const remaining = rows.filter((r) => r.status !== "완료").length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Trophy className="text-gold" /> 회차 정복
        </h1>
        <p className="text-muted">아직 안 푼 회차를 높은 회차부터 차례로 풀고, 회차를 마치면 다음 회차에서 취약 유형을 집중 공략합니다.</p>
      </header>

      <div className="card space-y-4 p-5">
        <div>
          <label className="mb-2 block text-sm font-medium">등급</label>
          <Chips
            value={level}
            onChange={(v) => setLevel(v as Level)}
            options={LEVELS.map((l) => ({ value: l.value, label: `${l.label} (${l.sub})` }))}
          />
        </div>

        {!loaded || !ready ? (
          <div className="flex justify-center p-6"><Loader2 className="animate-spin text-muted" /></div>
        ) : rows.length === 0 ? (
          <p className="rounded-lg bg-surface-2 p-4 text-sm text-muted">이 등급에 등록된 회차가 없습니다.</p>
        ) : (
          <>
            {target != null ? (
              <button
                className="btn btn-primary flex w-full items-center justify-center gap-2 py-3 text-base"
                onClick={() => startRound(target)}
                disabled={loadingRun}
              >
                {loadingRun ? <Loader2 className="animate-spin" size={18} /> : <><PlayCircle size={18} /> {target}회 {levelLabel} 이어풀기</>}
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-lg bg-green-500/10 p-4 text-sm font-semibold text-green-600">
                <Trophy size={18} /> 모든 회차를 완료했습니다! 오답노트로 마무리하세요.
              </div>
            )}
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Target size={13} /> 남은 회차 {remaining}개 · 전체 {rows.length}개 회차
            </p>
          </>
        )}
      </div>

      {loaded && ready && rows.length > 0 && (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.round}
              className={`card flex items-center gap-3 p-4 ${r.round === target ? "ring-1 ring-primary" : ""}`}
            >
              <StatusIcon status={r.status} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{r.round}회 <span className="text-sm font-normal text-muted">{levelLabel}</span></p>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${r.status === "완료" ? "bg-green-500" : "bg-primary"}`}
                    style={{ width: `${r.total ? Math.round((r.attempted / r.total) * 100) : 0}%` }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-sm text-muted">{r.attempted}/{r.total}</span>
              <button
                className="btn btn-outline shrink-0 px-3 py-1.5 text-sm"
                onClick={() => startRound(r.round)}
                disabled={loadingRun}
              >
                {r.status === "미착수" ? "시작" : r.status === "진행중" ? "이어풀기" : "다시"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "완료") return <CheckCircle2 size={20} className="shrink-0 text-green-500" />;
  if (status === "진행중") return <PlayCircle size={20} className="shrink-0 text-primary" />;
  return <CircleDashed size={20} className="shrink-0 text-muted" />;
}
