"use client";

import { useEffect, useState } from "react";
import { ERAS, QUESTION_TYPES, LEVELS } from "@/lib/domain";
import { fetchQuestions, fetchRounds } from "@/lib/api";
import type { QuestionDTO } from "@/lib/types";
import StudyRunner from "@/components/StudyRunner";
import Chips from "@/components/Chips";
import { Loader2 } from "lucide-react";

export default function StudyPage() {
  const [level, setLevel] = useState<string>("");
  const [era, setEra] = useState<string>("");
  const [qType, setQType] = useState<string>("");
  const [round, setRound] = useState<string>("");
  const [rounds, setRounds] = useState<number[]>([]);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuestionDTO[] | null>(null);

  useEffect(() => { fetchRounds().then(setRounds); }, []);

  async function start() {
    setLoading(true);
    const qs = await fetchQuestions({
      level: level || undefined,
      era: era || undefined,
      qType: qType || undefined,
      round: round || undefined,
      limit: count,
      random: true,
    });
    setQuestions(qs);
    setLoading(false);
  }

  if (questions) {
    return (
      <div className="space-y-4">
        <button className="text-sm text-muted hover:text-foreground" onClick={() => setQuestions(null)}>
          ← 조건 다시 설정
        </button>
        <StudyRunner questions={questions} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">문제풀이</h1>
        <p className="text-muted">시대·인물·유형별로 출제하여 학습합니다.</p>
      </header>

      <div className="card space-y-5 p-5">
        <Field label="등급">
          <Chips
            value={level}
            onChange={setLevel}
            options={[{ value: "", label: "전체" }, ...LEVELS.map((l) => ({ value: l.value, label: `${l.label}(${l.sub})` }))]}
          />
        </Field>

        <Field label="시대">
          <Chips
            value={era}
            onChange={setEra}
            options={[{ value: "", label: "전체" }, ...ERAS.map((e) => ({ value: e.key, label: e.label }))]}
          />
        </Field>

        <Field label="유형">
          <Chips
            value={qType}
            onChange={setQType}
            options={[{ value: "", label: "전체" }, ...QUESTION_TYPES.map((q) => ({ value: q.key, label: q.label }))]}
          />
        </Field>

        <Field label="회차">
          <select value={round} onChange={(e) => setRound(e.target.value)} className="w-full rounded-lg border bg-surface px-3 py-2 text-sm">
            <option value="">전체 회차</option>
            {rounds.map((r) => <option key={r} value={r}>{r}회</option>)}
          </select>
        </Field>

        <Field label={`문항 수: ${count}`}>
          <input
            type="range" min={5} max={50} step={5} value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="w-full accent-[var(--primary)]"
          />
        </Field>

        <button className="btn btn-primary w-full py-3" onClick={start} disabled={loading}>
          {loading ? <Loader2 className="animate-spin" size={18} /> : "학습 시작"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium">{label}</label>
      {children}
    </div>
  );
}
