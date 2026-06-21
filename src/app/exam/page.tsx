"use client";

import { useState } from "react";
import { LEVELS, EXAM_TOTAL_QUESTIONS, EXAM_DURATION_MIN, type Level } from "@/lib/domain";
import { fetchQuestions } from "@/lib/api";
import type { QuestionDTO } from "@/lib/types";
import ExamRunner from "@/components/ExamRunner";
import Chips from "@/components/Chips";
import { Loader2, Timer } from "lucide-react";

export default function ExamPage() {
  const [level, setLevel] = useState<Level>("SIMHWA");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionDTO[] | null>(null);
  const [warn, setWarn] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setWarn(null);
    const qs = await fetchQuestions({ level, limit: EXAM_TOTAL_QUESTIONS, random: true });
    setLoading(false);
    if (qs.length === 0) {
      setWarn("해당 등급의 문항이 없습니다. 문제은행에 먼저 문항을 추가하세요.");
      return;
    }
    if (qs.length < EXAM_TOTAL_QUESTIONS) {
      setWarn(`문항이 ${qs.length}개뿐이라 ${qs.length}문항으로 진행합니다. (점수는 50문항 기준 환산)`);
    }
    setQuestions(qs);
  }

  if (questions) {
    return <ExamRunner questions={questions} level={level} onExit={() => setQuestions(null)} />;
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">실전 모의고사</h1>
        <p className="text-muted">
          {EXAM_TOTAL_QUESTIONS}문항 · {EXAM_DURATION_MIN}분 · 자동 채점 및 급수 환산
        </p>
      </header>

      <div className="card space-y-5 p-6">
        <div>
          <label className="mb-2 block text-sm font-medium">응시 등급</label>
          <Chips
            value={level}
            onChange={(v) => setLevel(v as Level)}
            options={LEVELS.map((l) => ({ value: l.value, label: `${l.label} (${l.sub})` }))}
          />
        </div>

        <div className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground"><Timer size={15} /> 진행 방식</p>
          <ul className="ml-4 list-disc space-y-0.5">
            <li>전 문항을 자유롭게 이동하며 OMR로 표기</li>
            <li>제한 시간 종료 시 자동 제출·채점</li>
            <li>심화 60점↑ 3급 / 70점↑ 2급 / 80점↑ 1급</li>
          </ul>
        </div>

        {warn && <p className="rounded bg-accent/10 p-2 text-sm text-accent">{warn}</p>}

        <button className="btn btn-primary w-full py-3" onClick={start} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : "모의고사 시작"}
        </button>
      </div>
    </div>
  );
}
