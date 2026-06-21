"use client";

import { useState } from "react";
import { ERAS, QUESTION_TYPES, LEVELS } from "@/lib/domain";
import { useUI } from "@/components/ui/UIProvider";
import { Loader2 } from "lucide-react";

/** 관리자 전용: 단일 문항 수동 추가 */
export default function ManualForm({ onSaved }: { onSaved: () => void }) {
  const { toast } = useUI();
  const [level, setLevel] = useState("SIMHWA");
  const [era, setEra] = useState("joseon");
  const [qType, setQType] = useState("개념형");
  const [stem, setStem] = useState("");
  const [passage, setPassage] = useState("");
  const [imageDescription, setImageDescription] = useState("");
  const [choices, setChoices] = useState(["", "", "", "", ""]);
  const [answerIndex, setAnswerIndex] = useState(0);
  const [explanation, setExplanation] = useState("");
  const [topics, setTopics] = useState("");
  const [examRound, setExamRound] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const filled = choices.map((c) => c.trim()).filter(Boolean);
    if (!stem.trim() || filled.length < 2) {
      toast("발문과 2개 이상의 선지를 입력하세요.", "error");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level, era, qType, stem, passage,
        imageDescription,
        choices: filled,
        answerIndex: Math.min(answerIndex, filled.length - 1),
        explanation,
        topics: topics.split(",").map((t) => t.trim()).filter(Boolean),
        examRound: examRound ? Number(examRound) : undefined,
      }),
    });
    setSaving(false);
    if (res.ok) {
      setStem(""); setPassage(""); setImageDescription(""); setChoices(["", "", "", "", ""]); setAnswerIndex(0); setExplanation(""); setTopics("");
      onSaved();
    } else {
      const d = await res.json().catch(() => ({}));
      toast(d.error || "저장 실패", "error");
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <div className="flex flex-wrap gap-2 text-sm">
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="rounded border bg-surface px-2 py-1.5">
          {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <select value={era} onChange={(e) => setEra(e.target.value)} className="rounded border bg-surface px-2 py-1.5">
          {ERAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
        </select>
        <select value={qType} onChange={(e) => setQType(e.target.value)} className="rounded border bg-surface px-2 py-1.5">
          {QUESTION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
        <input value={examRound} onChange={(e) => setExamRound(e.target.value)} placeholder="회차" className="w-20 rounded border bg-surface px-2 py-1.5" />
      </div>
      <textarea value={passage} onChange={(e) => setPassage(e.target.value)} placeholder="사료/자료 지문 (선택)" rows={2} className="w-full rounded border bg-surface p-2 text-sm" />
      <textarea value={imageDescription} onChange={(e) => setImageDescription(e.target.value)} placeholder="그림/지도/사진 묘사 (선택) — 시각 자료가 있으면 글로 설명" rows={2} className="w-full rounded border border-accent/30 bg-accent/5 p-2 text-sm" />
      <textarea value={stem} onChange={(e) => setStem(e.target.value)} placeholder="문제 발문" rows={2} className="w-full rounded border bg-surface p-2 text-sm" />
      {choices.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="radio" name="ans" checked={answerIndex === i} onChange={() => setAnswerIndex(i)} className="accent-[var(--primary)]" />
          <input value={c} onChange={(e) => setChoices((cs) => cs.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={`선지 ${i + 1}`} className="flex-1 rounded border bg-surface px-2 py-1.5 text-sm" />
        </div>
      ))}
      <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="주제/인물 태그 (쉼표 구분)" className="w-full rounded border bg-surface px-2 py-1.5 text-sm" />
      <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="해설 (선택)" rows={2} className="w-full rounded border bg-surface p-2 text-sm" />
      <button className="btn btn-primary w-full py-2.5" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="animate-spin" size={18} /> : "문항 저장"}
      </button>
    </div>
  );
}
