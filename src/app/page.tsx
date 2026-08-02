"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/useStore";
import { dueQuestionIds, checkInToday, latestExam, roundAttemptCounts, nextTargetRound } from "@/lib/local-store";
import { fetchRounds, fetchRoundStats, type RoundStat } from "@/lib/api";
import { daysBetween } from "@/lib/utils";
import { eraLabel, qTypeLabel, levelLabel } from "@/lib/domain";
import DailyKickoff from "@/components/DailyKickoff";
import {
  Library, PencilLine, Timer, CalendarClock, BarChart3, GitBranch,
  Network, MessageCircleQuestion, Layers, CalendarRange, ScrollText, Flame, Trophy, Target, CalendarCheck,
  ChevronDown, CheckCircle2, ArrowRight, ClipboardCheck, TrendingUp,
} from "lucide-react";

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

// 메인 4개 — 3개월 수험생의 핵심 루프: 기출 풀고 → 실전 점검 → 오답 정착 → 흐름 정리
const MAIN_TILES = [
  { href: "/bank", label: "기출문제", desc: "기출 문항 열람·풀이", icon: Library },
  { href: "/exam", label: "모의고사", desc: "50문항 실전·합격 판정", icon: Timer },
  { href: "/review", label: "오답노트", desc: "틀린 문제 간격반복 복습", icon: CalendarClock },
  { href: "/timeline", label: "연대표", desc: "시대 흐름 한눈에", icon: GitBranch },
];

// 추가기능 — 필요 시 펼쳐 보는 나머지 도구
const MORE_TILES = [
  { href: "/rounds", label: "회차 정복", desc: "미착수 회차 높은순 정복", icon: Trophy },
  { href: "/study", label: "문제풀이", desc: "시대·인물·유형별 학습", icon: PencilLine },
  { href: "/saryo", label: "사료 트레이닝", desc: "자료 제시형 집중", icon: ScrollText },
  { href: "/flashcards", label: "빈출 암기카드", desc: "핵심 키워드 플래시카드", icon: Layers },
  { href: "/analytics", label: "통계·경향", desc: "취약영역·출제경향", icon: BarChart3 },
  { href: "/network", label: "관계망", desc: "인물·사건 연결", icon: Network },
  { href: "/plan", label: "학습 플랜", desc: "D-day 맞춤 커리큘럼", icon: CalendarRange },
  { href: "/tutor", label: "AI 튜터", desc: "질문하면 바로 해설", icon: MessageCircleQuestion },
];

interface ReleaseMeta {
  current: { version: number; title: string; publishedAt: string } | null;
  meta: { total: number; latestRound: number | null; updatedAt: string | null };
}

export default function Home() {
  const { store, ready, update } = useStore();
  const router = useRouter();
  const [rel, setRel] = useState<ReleaseMeta | null>(null);
  const [kickoff, setKickoff] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [rounds, setRounds] = useState<number[]>([]);
  const [roundStats, setRoundStats] = useState<RoundStat[]>([]);

  useEffect(() => {
    fetch("/api/releases").then((r) => r.json()).then(setRel).catch(() => {});
    Promise.all([fetchRounds(), fetchRoundStats()]).then(([r, s]) => { setRounds(r); setRoundStats(s); });
  }, []);

  // 오늘 첫 방문이면 출석 체크 + 시작 팝업 (하루 1회)
  useEffect(() => {
    if (!ready) return;
    const today = todayStr();
    if (store.attendance.lastDay !== today) {
      update((s) => checkInToday(s, today));
      setKickoff(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const stats = useMemo(() => {
    const due = dueQuestionIds(store).length;
    const dday = store.settings.examDate
      ? daysBetween(new Date(), new Date(store.settings.examDate))
      : null;
    return { due, dday };
  }, [store]);

  // 다음 정복 회차 — 목표 등급 기준, 아직 완료하지 않은 가장 높은 회차
  const nextRound = useMemo(() => {
    if (!ready || rounds.length === 0) return null;
    const level = store.settings.targetLevel;
    const counts = roundAttemptCounts(store, level);
    const completed = new Set<number>();
    const available: number[] = [];
    for (const r of rounds) {
      const stat = roundStats.find((x) => x.round === r);
      const total = stat ? (level === "SIMHWA" ? stat.simhwa : stat.gibon) : 0;
      if (total <= 0) continue;
      available.push(r);
      if ((counts[r] ?? 0) >= total) completed.add(r);
    }
    return nextTargetRound(available, completed);
  }, [ready, store, rounds, roundStats]);

  const exam = ready ? latestExam(store) : null;
  const solvedToday = ready && store.streak.studyDays.includes(todayStr());
  const examStale = !exam || Date.now() - exam.ts > 7 * 86_400_000;
  const finalStretch = stats.dday !== null && stats.dday >= 0 && stats.dday <= 7;

  // 오답 패턴 기반 취약 태그 Top 3 추출
  const topTags = useMemo(() => {
    if (!ready) return [];
    const counts: Record<string, number> = {};
    store.attempts.forEach((a) => {
      if (!a.correct) {
        const keyEra = eraLabel(a.era);
        const keyType = qTypeLabel(a.qType);
        counts[keyEra] = (counts[keyEra] || 0) + 1;
        counts[keyType] = (counts[keyType] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(x => x[0]);
  }, [store, ready]);

  // 합격 예측률 산출: 최근 모의고사 3회 평균(70%) + 전체 정답률(30%) 가중 평균
  const passRate = useMemo(() => {
    if (!ready) return null;
    const history = store.examHistory;
    if (history.length === 0 && store.attempts.length === 0) return null;

    let rate = 0;
    let hasExam = false;

    if (history.length > 0) {
      // 최근 3회 모의고사 평균 점수 → 100점 만점 기준 예측률
      const recent = history.slice(-3);
      const avgScore = recent.reduce((sum, e) => sum + e.score100, 0) / recent.length;
      hasExam = true;

      if (store.attempts.length >= 10) {
        // 모의고사 70% + 전체 정답률 30%
        const correctRate = store.attempts.filter(a => a.correct).length / store.attempts.length * 100;
        rate = avgScore * 0.7 + correctRate * 0.3;
      } else {
        rate = avgScore;
      }
    } else if (store.attempts.length >= 10) {
      // 모의고사 없고 풀이 기록만 있을 때
      rate = store.attempts.filter(a => a.correct).length / store.attempts.length * 100;
    } else {
      return null;
    }

    // 60점 합격선 기준으로 합격 확률 변환 (sigmoid-like)
    // rate >= 70 → 90%+, rate = 60 → 50%, rate <= 40 → <10%
    const diff = rate - 60;
    const probability = Math.round(100 / (1 + Math.exp(-diff / 8)));
    return { rate: Math.round(rate), probability, hasExam };
  }, [store, ready]);

  // 시험이 2주 이내면 사료·암기카드 등 막판 도구를 바로 펼쳐 보인다
  useEffect(() => {
    if (ready && stats.dday !== null && stats.dday >= 0 && stats.dday <= 14) setShowMore(true);
  }, [ready, stats.dday]);

  return (
    <div className="animate-in space-y-6">
      {kickoff && (
        <DailyKickoff
          attendance={store.attendance}
          onSolve={() => { setKickoff(false); router.push("/study?warmup=1"); }}
          onClose={() => setKickoff(false)}
        />
      )}

      {/* 상황판 — D-day · 합격권 · 오늘 할 일 */}
      <section className="card overflow-hidden">
        <div className="space-y-4 bg-gradient-to-br from-primary/15 to-accent/10 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            {/* D-day */}
            {ready && stats.dday !== null ? (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-extrabold text-primary sm:text-5xl">
                  {stats.dday >= 0 ? `D-${stats.dday}` : "시험일 지남"}
                </span>
                <Link href="/plan" className="text-sm text-muted hover:text-foreground">
                  {store.settings.examDate}
                </Link>
              </div>
            ) : (
              <label className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1.5 font-semibold"><Target size={18} className="text-accent" /> 시험일을 등록하세요</span>
                <input
                  type="date"
                  className="rounded-lg border bg-surface px-3 py-1.5 text-sm"
                  onChange={(e) => {
                    if (e.target.value) update((s) => ({ ...s, settings: { ...s.settings, examDate: e.target.value } }));
                  }}
                />
                <span className="text-xs text-muted">등록하면 D-day 기준 맞춤 플랜이 시작됩니다</span>
              </label>
            )}

            {/* 합격권 배지 — "나 지금 합격권인가?"에 3초 안에 답한다 */}
            {ready && (
              exam ? (
                <Link
                  href="/analytics"
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${
                    exam.passed
                      ? "border-green-500/40 bg-green-500/10 text-green-600"
                      : "border-red-500/40 bg-red-500/10 text-red-500"
                  }`}
                >
                  <ClipboardCheck size={17} />
                  최근 모의고사 {exam.score100}점 — {exam.passed ? `${exam.grade}급 합격권` : "합격선(60점) 미달"}
                  {passRate && (
                    <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
                      passRate.probability >= 70 ? "bg-green-500/15 text-green-600" :
                      passRate.probability >= 40 ? "bg-yellow-500/15 text-yellow-700" :
                      "bg-red-500/15 text-red-500"
                    }`}>
                      합격 예측 {passRate.probability}%
                    </span>
                  )}
                  <span className="font-normal text-muted">
                    {daysBetween(new Date(exam.ts), new Date()) === 0 ? "오늘" : `${daysBetween(new Date(exam.ts), new Date())}일 전`}
                  </span>
                </Link>
              ) : (
                <Link href="/exam" className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
                  <ClipboardCheck size={17} /> 모의고사로 현재 실력 진단하기 <ArrowRight size={15} />
                </Link>
              )
            )}
          </div>

          {/* 오늘 할 일 */}
          {ready && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">오늘 할 일</p>
                {topTags.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted">집중 복습 추천:</span>
                    {topTags.map(t => (
                      <span key={t} className="rounded-full bg-red-500/10 text-red-500 px-2 py-0.5 text-xs font-medium">#{t}</span>
                    ))}
                  </div>
                )}
              </div>
              {stats.due > 0 && (
                <TaskRow href="/review" label={`복습 대기 ${stats.due}문항 비우기`} sub="망각곡선이 리셋되기 전에" accent />
              )}
              {nextRound != null && (
                <TaskRow
                  href="/rounds"
                  label={`회차 정복 — ${nextRound}회 ${levelLabel(store.settings.targetLevel)} 이어풀기`}
                  sub="미착수 회차를 높은순으로"
                />
              )}
              <TaskRow
                href="/study?warmup=1"
                label="오늘의 워밍업 — 취약 시대 5문제"
                sub={solvedToday ? "오늘 학습 완료!" : "5분이면 충분해요"}
                done={solvedToday}
              />
              {examStale && (
                <TaskRow
                  href="/exam"
                  label={exam ? "이번 주 모의고사로 실력 점검" : "첫 모의고사로 출발점 확인"}
                  sub="주 1회 실전 점검이 합격 페이스의 기준"
                />
              )}
              {finalStretch && (
                <TaskRow href="/saryo" label="막판 정리 — 사료 트레이닝·암기카드" sub={`시험까지 ${stats.dday}일. 자료형·빈출 키워드 집중`} accent />
              )}
            </div>
          )}
        </div>
      </section>

      {/* 요약 지표 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Metric icon={<CalendarCheck size={18} className="text-accent" />} label="누적 출석" value={ready ? `${store.attendance.total}일` : "—"} href="/plan" />
        <Metric icon={<Target size={18} />} label="D-day" value={
          ready && stats.dday !== null ? (stats.dday >= 0 ? `D-${stats.dday}` : "지남") : "미설정"
        } href="/plan" />
        <Metric icon={<Flame size={18} className="text-accent" />} label="연속 학습" value={ready ? `${store.streak.current}일` : "—"} href="/plan" />
        <Metric
          icon={<ClipboardCheck size={18} />}
          label="최근 모의고사"
          value={ready ? (exam ? `${exam.score100}점` : "미응시") : "—"}
          href={exam ? "/analytics" : "/exam"}
        />
        <Metric
          icon={<TrendingUp size={18} className={passRate && passRate.probability >= 60 ? "text-green-500" : "text-red-400"} />}
          label="합격 예측률"
          value={ready ? (passRate ? `${passRate.probability}%` : "데이터 부족") : "—"}
          href="/analytics"
        />
        <Metric icon={<CalendarClock size={18} />} label="복습 대기" value={ready ? `${stats.due}` : "—"} href="/review" />
      </section>

      {/* 배지 */}
      {ready && store.badges.length > 0 && (
        <section className="card flex flex-wrap items-center gap-2 p-4">
          <Trophy size={18} className="text-gold" />
          {store.badges.map((b) => (
            <span key={b} className="rounded-full bg-gold/15 px-2.5 py-1 text-xs font-medium text-gold">
              {badgeName(b)}
            </span>
          ))}
        </section>
      )}

      {/* 학습 도구 — 메인 4개 + 추가기능 */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">학습 도구</h2>
          <button
            onClick={() => setShowMore((v) => !v)}
            className="flex items-center gap-1 text-sm text-muted hover:text-foreground"
          >
            추가기능 {showMore ? "접기" : "펼치기"}
            <ChevronDown size={15} className={showMore ? "rotate-180 transition-transform" : "transition-transform"} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MAIN_TILES.map((t) => <FeatureTile key={t.href} {...t} />)}
        </div>

        {showMore && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MORE_TILES.map((t) => <FeatureTile key={t.href} {...t} />)}
          </div>
        )}
      </section>

      {/* 데이터셋 업데이트 정보 — 참고용이므로 맨 아래 */}
      <Link href="/updates" className="card card-hover flex flex-wrap items-center gap-x-4 gap-y-1 p-3 text-sm">
        <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-bold text-primary">
          데이터셋 {rel?.current ? `v${rel.current.version}` : "준비 중"}
        </span>
        <span className="text-muted">총 {rel?.meta.total ?? "—"}문항</span>
        {rel?.meta.latestRound != null && <span className="text-muted">최근 반영 {rel.meta.latestRound}회</span>}
        <span className="text-muted">
          최종 업데이트 {rel?.meta.updatedAt ? new Date(rel.meta.updatedAt).toLocaleDateString("ko-KR") : "—"}
        </span>
        <span className="ml-auto text-primary">업데이트 내역 →</span>
      </Link>
    </div>
  );
}

function TaskRow({ href, label, sub, accent, done }: { href: string; label: string; sub?: string; accent?: boolean; done?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-xl border bg-surface/70 px-3 py-2.5 text-sm transition-colors hover:bg-surface ${
        accent ? "border-accent/40" : ""
      } ${done ? "opacity-70" : ""}`}
    >
      <CheckCircle2 size={17} className={done ? "text-green-500" : accent ? "text-accent" : "text-muted"} />
      <span className={`font-medium ${done ? "line-through" : ""}`}>{label}</span>
      {sub && <span className="hidden text-xs text-muted sm:inline">{sub}</span>}
      <ArrowRight size={15} className="ml-auto text-muted" />
    </Link>
  );
}

function FeatureTile({ href, label, desc, icon: Icon }: { href: string; label: string; desc: string; icon: React.ComponentType<{ size?: number }> }) {
  return (
    <Link href={href} className="card card-hover group flex flex-col gap-2 p-4">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
        <Icon size={20} />
      </span>
      <span className="font-semibold">{label}</span>
      <span className="text-xs text-muted">{desc}</span>
    </Link>
  );
}

function Metric({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="card card-hover flex flex-col gap-1 p-4">
      <span className="flex items-center gap-1.5 text-xs text-muted">{icon}{label}</span>
      <span className="text-xl font-bold">{value}</span>
    </Link>
  );
}

const BADGE_NAMES: Record<string, string> = {
  "first-step": "첫걸음", ten: "10문항", fifty: "50문항", century: "100문항",
  streak3: "3일 연속", streak7: "7일 연속", sharpshooter: "명사수",
};
function badgeName(id: string) {
  return BADGE_NAMES[id] ?? id;
}
