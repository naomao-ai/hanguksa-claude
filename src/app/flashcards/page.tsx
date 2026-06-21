"use client";

import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/lib/useStore";
import { reviewFlashcard } from "@/lib/local-store";
import { fetchFacts } from "@/lib/api";
import { ERAS, eraLabel, eraColor } from "@/lib/domain";
import type { FactDTO } from "@/lib/types";
import { Loader2, Layers, RotateCcw } from "lucide-react";

export default function FlashcardsPage() {
  const { update } = useStore();
  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [era, setEra] = useState("");
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchFacts(era || undefined).then((f) => {
      setFacts(f.sort(() => Math.random() - 0.5));
      setIdx(0);
      setFlipped(false);
      setLoading(false);
    });
  }, [era]);

  const card = facts[idx];
  const done = idx >= facts.length;

  function grade(g: number) {
    if (!card) return;
    update((s) => reviewFlashcard(s, card.title, g));
    setIdx((i) => i + 1);
    setFlipped(false);
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Layers className="text-primary" /> 빈출 암기카드</h1>
        <p className="text-muted">핵심 키워드를 플래시카드로 암기합니다. (간격반복 적용)</p>
      </header>

      <select value={era} onChange={(e) => setEra(e.target.value)} className="rounded-lg border bg-surface px-3 py-1.5 text-sm">
        <option value="">전체 시대</option>
        {ERAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
      </select>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted" /></div>
      ) : facts.length === 0 ? (
        <div className="card p-8 text-center text-muted">암기카드가 없습니다.</div>
      ) : done ? (
        <div className="card p-8 text-center">
          <p className="mb-4 text-lg font-semibold">{facts.length}장 학습 완료 🎉</p>
          <button className="btn btn-outline px-4 py-2" onClick={() => { setIdx(0); setFlipped(false); setFacts((f) => [...f].sort(() => Math.random() - 0.5)); }}>
            <RotateCcw size={16} /> 다시
          </button>
        </div>
      ) : (
        <>
          <div className="mb-1 text-right text-sm text-muted">{idx + 1} / {facts.length}</div>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="card flex min-h-[220px] w-full flex-col items-center justify-center gap-3 p-8 text-center transition-colors hover:border-primary/40"
          >
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
              style={{ background: eraColor(card.era) }}
            >
              {eraLabel(card.era)}{card.year != null ? ` · ${card.year < 0 ? `BC ${-card.year}` : card.year}` : ""}
            </span>
            {!flipped ? (
              <span className="text-2xl font-bold">{card.title}</span>
            ) : (
              <span className="text-base leading-relaxed">{card.body}</span>
            )}
            <span className="text-xs text-muted">{flipped ? "" : "카드를 눌러 뜻 보기"}</span>
          </button>

          {flipped && (
            <div className="grid grid-cols-3 gap-2">
              <button className="btn btn-outline py-2.5 text-sm" onClick={() => grade(1)}>모름</button>
              <button className="btn btn-outline py-2.5 text-sm" onClick={() => grade(3)}>애매</button>
              <button className="btn btn-primary py-2.5 text-sm" onClick={() => grade(5)}>완벽</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
