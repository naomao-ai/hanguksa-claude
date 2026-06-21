"use client";

import { useState } from "react";
import { fetchQuestions } from "@/lib/api";
import type { QuestionDTO } from "@/lib/types";
import StudyRunner from "@/components/StudyRunner";
import { Loader2, ScrollText } from "lucide-react";

export default function SaryoPage() {
  const [questions, setQuestions] = useState<QuestionDTO[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setWarn(null);
    // 자료 제시형 우선, 부족하면 사료(passage)가 있는 문항으로 보완
    let qs = await fetchQuestions({ qType: "자료제시형", limit: 20, random: true });
    if (qs.length === 0) {
      const all = await fetchQuestions({ limit: 200, random: true });
      qs = all.filter((q) => q.passage).slice(0, 20);
    }
    setLoading(false);
    if (qs.length === 0) {
      setWarn("자료 제시형 문항이 없습니다. 문제은행에 사료가 포함된 문항을 추가하세요.");
      return;
    }
    setQuestions(qs);
  }

  if (questions) {
    return (
      <div className="space-y-4">
        <button className="text-sm text-muted hover:text-foreground" onClick={() => setQuestions(null)}>← 사료 트레이닝 메뉴로</button>
        <StudyRunner questions={questions} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><ScrollText className="text-gold" /> 사료 해석 트레이닝</h1>
        <p className="text-muted">한능검 빈출 &lsquo;자료 제시형&rsquo; 문항으로 사료 해석력을 집중 훈련합니다.</p>
      </header>

      <div className="card space-y-4 p-6">
        <div className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
          <p className="mb-1 font-medium text-foreground">학습 포인트</p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>사료의 핵심 키워드(인물·제도·사건)를 먼저 포착</li>
            <li>키워드로 시대·주체를 특정하는 연습</li>
            <li>선지의 시대 불일치를 가려내는 훈련</li>
          </ul>
        </div>
        {warn && <p className="rounded bg-accent/10 p-2 text-sm text-accent">{warn}</p>}
        <button className="btn btn-primary w-full py-3" onClick={start} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : "트레이닝 시작"}
        </button>
      </div>
    </div>
  );
}
