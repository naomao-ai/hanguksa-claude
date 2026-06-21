"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/useStore";
import { dueQuestionIds, wrongQuestionIds } from "@/lib/local-store";
import { daysBetween, pct } from "@/lib/utils";
import {
  Library, PencilLine, Timer, CalendarClock, BarChart3, GitBranch,
  Network, MessageCircleQuestion, Layers, CalendarRange, ScrollText, Flame, Trophy, Target,
} from "lucide-react";

const TILES = [
  { href: "/bank", label: "문제은행", desc: "기출 업로드·AI 분석", icon: Library },
  { href: "/study", label: "문제풀이", desc: "시대·인물·유형별 학습", icon: PencilLine },
  { href: "/exam", label: "모의고사", desc: "50문항 실전·자동채점", icon: Timer },
  { href: "/review", label: "오답·복습", desc: "간격반복(SRS) 복습", icon: CalendarClock },
  { href: "/saryo", label: "사료 트레이닝", desc: "자료 제시형 집중", icon: ScrollText },
  { href: "/flashcards", label: "빈출 암기카드", desc: "핵심 키워드 플래시카드", icon: Layers },
  { href: "/analytics", label: "통계·경향", desc: "취약영역·출제경향", icon: BarChart3 },
  { href: "/timeline", label: "연표", desc: "시대 흐름 한눈에", icon: GitBranch },
  { href: "/network", label: "관계망", desc: "인물·사건 연결", icon: Network },
  { href: "/plan", label: "학습 플랜", desc: "D-day 맞춤 커리큘럼", icon: CalendarRange },
  { href: "/tutor", label: "AI 튜터", desc: "질문하면 바로 해설", icon: MessageCircleQuestion },
];

interface ReleaseMeta {
  current: { version: number; title: string; publishedAt: string } | null;
  meta: { total: number; latestRound: number | null; updatedAt: string | null };
}

export default function Home() {
  const { store, ready } = useStore();
  const [rel, setRel] = useState<ReleaseMeta | null>(null);

  useEffect(() => {
    fetch("/api/releases").then((r) => r.json()).then(setRel).catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const total = store.attempts.length;
    const correct = store.attempts.filter((a) => a.correct).length;
    const due = dueQuestionIds(store).length;
    const wrong = wrongQuestionIds(store).length;
    const dday = store.settings.examDate
      ? daysBetween(new Date(), new Date(store.settings.examDate))
      : null;
    return { total, correct, due, wrong, dday };
  }, [store]);

  return (
    <div className="animate-in space-y-6">
      {/* 히어로 */}
      <section className="card overflow-hidden">
        <div className="bg-gradient-to-br from-primary/15 to-accent/10 p-6 sm:p-8">
          <h1 className="text-2xl font-bold sm:text-3xl">한국사 마스터</h1>
          <p className="mt-1 text-muted">
            한국사능력검정시험(한능검) 합격까지 — 분석·학습·복습을 한 곳에서.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/study" className="btn btn-primary px-4 py-2.5">문제풀이 시작</Link>
            <Link href="/bank" className="btn btn-outline px-4 py-2.5">문제은행 열람</Link>
          </div>
        </div>
      </section>

      {/* 데이터셋 업데이트 기준 정보 */}
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

      {/* 요약 지표 */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Metric icon={<Target size={18} />} label="D-day" value={
          ready && stats.dday !== null ? (stats.dday >= 0 ? `D-${stats.dday}` : "지남") : "미설정"
        } href="/plan" />
        <Metric icon={<Flame size={18} className="text-accent" />} label="연속 학습" value={ready ? `${store.streak.current}일` : "—"} href="/plan" />
        <Metric icon={<BarChart3 size={18} />} label="누적 정답률" value={ready && stats.total ? pct(stats.correct / stats.total) : "—"} href="/analytics" />
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

      {/* 기능 타일 */}
      <section>
        <h2 className="mb-3 text-lg font-semibold">학습 도구</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {TILES.map(({ href, label, desc, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="card card-hover group flex flex-col gap-2 p-4"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary">
                <Icon size={20} />
              </span>
              <span className="font-semibold">{label}</span>
              <span className="text-xs text-muted">{desc}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
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
