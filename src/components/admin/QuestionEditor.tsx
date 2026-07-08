"use client";

import { useEffect, useRef, useState } from "react";
import { ERAS, QUESTION_TYPES, LEVELS } from "@/lib/domain";
import { useUI } from "@/components/ui/UIProvider";
import { fetchFacts } from "@/lib/api";
import type { FactDTO, QuestionDTO } from "@/lib/types";
import { Loader2, ImagePlus, X, Plus, Check } from "lucide-react";

interface ChoiceRow {
  text: string;
  imageUrl: string | null; // https URL(기존) 또는 data URL(신규 업로드)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("파일 읽기 실패"));
    r.readAsDataURL(file);
  });
}

/**
 * 문항 생성·수정 겸용 편집기.
 * initial 이 있으면 수정(PATCH), 없으면 생성(POST).
 * 선지마다 텍스트 + 이미지(그림 선지)를 넣을 수 있다.
 */
export default function QuestionEditor({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: QuestionDTO;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { toast } = useUI();
  const isEdit = !!initial;

  const [level, setLevel] = useState(initial?.level ?? "SIMHWA");
  const [era, setEra] = useState(initial?.era ?? "joseon");
  const [qType, setQType] = useState(initial?.qType ?? "개념형");
  const [stem, setStem] = useState(initial?.stem ?? "");
  const [passage, setPassage] = useState(initial?.passage ?? "");
  const [imageDescription, setImageDescription] = useState(initial?.imageDescription ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [choices, setChoices] = useState<ChoiceRow[]>(
    initial
      ? initial.choices.map((c) => ({ text: c.text, imageUrl: c.imageUrl }))
      : [
          { text: "", imageUrl: null },
          { text: "", imageUrl: null },
          { text: "", imageUrl: null },
          { text: "", imageUrl: null },
          { text: "", imageUrl: null },
        ]
  );
  const [answerIndex, setAnswerIndex] = useState(initial?.answerIndex ?? 0);
  const [explanation, setExplanation] = useState(initial?.explanation ?? "");
  const [topics, setTopics] = useState((initial?.topics ?? []).join(", "));
  const [examRound, setExamRound] = useState(initial?.examRound ? String(initial.examRound) : "");
  const [saving, setSaving] = useState(false);

  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [factIds, setFactIds] = useState<string[]>(initial?.factIds ?? []);

  const stemImgRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchFacts(era).then(setFacts);
    // 시대 변경 시(생성 모드에서만) 연결 초기화
    if (!isEdit) setFactIds([]);
  }, [era, isEdit]);

  function setChoice(i: number, patch: Partial<ChoiceRow>) {
    setChoices((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  async function pickChoiceImage(i: number, file: File | undefined) {
    if (!file) return;
    try {
      setChoice(i, { imageUrl: await readAsDataUrl(file) });
    } catch {
      toast("이미지를 불러오지 못했습니다.", "error");
    }
  }

  async function pickStemImage(file: File | undefined) {
    if (!file) return;
    try {
      setImageUrl(await readAsDataUrl(file));
    } catch {
      toast("이미지를 불러오지 못했습니다.", "error");
    }
  }

  function addChoice() {
    if (choices.length >= 6) return;
    setChoices((cs) => [...cs, { text: "", imageUrl: null }]);
  }

  function removeChoice(i: number) {
    if (choices.length <= 2) return;
    setChoices((cs) => cs.filter((_, idx) => idx !== i));
    setAnswerIndex((a) => (a === i ? 0 : a > i ? a - 1 : a));
  }

  async function save() {
    // 텍스트나 이미지 중 하나라도 있는 선지만 유효
    const valid = choices.filter((c) => c.text.trim() || c.imageUrl);
    if (!stem.trim() || valid.length < 2) {
      toast("발문과 2개 이상의 선지(텍스트 또는 그림)를 입력하세요.", "error");
      return;
    }
    setSaving(true);
    const payload = {
      level,
      era,
      qType,
      stem,
      passage,
      imageDescription,
      imageUrl,
      choices: valid.map((c) => ({ text: c.text.trim(), imageUrl: c.imageUrl })),
      answerIndex: Math.min(answerIndex, valid.length - 1),
      explanation,
      topics: topics.split(",").map((t) => t.trim()).filter(Boolean),
      examRound: examRound ? Number(examRound) : undefined,
      factIds,
    };
    const res = await fetch(isEdit ? `/api/questions/${initial!.id}` : "/api/questions", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (res.ok) {
      toast(isEdit ? "수정되었습니다." : "문항이 저장되었습니다.", "success");
      onSaved();
    } else {
      const d = await res.json().catch(() => ({}));
      toast(d.error || "저장 실패", "error");
    }
  }

  return (
    <div className="card space-y-3 p-5">
      {isEdit && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">문항 수정</h3>
          {onCancel && <button onClick={onCancel} className="btn btn-ghost px-2 py-1 text-sm"><X size={15} /> 닫기</button>}
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        <select value={level} onChange={(e) => setLevel(e.target.value as QuestionDTO["level"])} className="rounded border bg-surface px-2 py-1.5">
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

      {/* 발문 대표 그림 */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => stemImgRef.current?.click()} className="btn btn-outline px-3 py-1.5 text-sm">
          <ImagePlus size={15} /> 문제 그림 {imageUrl ? "변경" : "추가"}
        </button>
        <input ref={stemImgRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickStemImage(e.target.files?.[0])} />
        {imageUrl && (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="문제 그림" className="h-14 rounded border" />
            <button onClick={() => setImageUrl(null)} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-xs text-white">×</button>
          </div>
        )}
      </div>
      <textarea value={imageDescription} onChange={(e) => setImageDescription(e.target.value)} placeholder="그림 묘사 (선택) — 시각 자료를 글로 설명" rows={2} className="w-full rounded border border-accent/30 bg-accent/5 p-2 text-sm" />

      <textarea value={stem} onChange={(e) => setStem(e.target.value)} placeholder="문제 발문" rows={2} className="w-full rounded border bg-surface p-2 text-sm" />

      {/* 선지 (텍스트 + 그림) */}
      <div className="space-y-2">
        <p className="text-xs text-muted">정답 선지에 라디오를 체크하세요. 선지에 그림을 넣을 수 있습니다.</p>
        {choices.map((c, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border p-2">
            <input type="radio" name="ans" checked={answerIndex === i} onChange={() => setAnswerIndex(i)} className="mt-2 accent-[var(--primary)]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <input value={c.text} onChange={(e) => setChoice(i, { text: e.target.value })}
                placeholder={`선지 ${i + 1} (그림만 있으면 비워도 됨)`}
                className="w-full rounded border bg-surface px-2 py-1.5 text-sm" />
              <div className="flex items-center gap-2">
                <ChoiceImageButton index={i} onPick={(f) => pickChoiceImage(i, f)} has={!!c.imageUrl} />
                {c.imageUrl && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.imageUrl} alt={`선지 ${i + 1} 그림`} className="h-14 rounded border" />
                    <button onClick={() => setChoice(i, { imageUrl: null })} className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-xs text-white">×</button>
                  </div>
                )}
              </div>
            </div>
            {choices.length > 2 && (
              <button onClick={() => removeChoice(i)} title="선지 삭제" className="mt-1 text-muted hover:text-red-500"><X size={16} /></button>
            )}
          </div>
        ))}
        {choices.length < 6 && (
          <button onClick={addChoice} className="btn btn-ghost px-2 py-1 text-sm"><Plus size={15} /> 선지 추가</button>
        )}
      </div>

      <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="주제/인물 태그 (쉼표 구분)" className="w-full rounded border bg-surface px-2 py-1.5 text-sm" />

      {facts.length > 0 && (
        <div className="rounded border bg-surface-2 p-2">
          <p className="mb-1 text-xs text-muted">관련 연표 연결 (선택)</p>
          <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
            {facts.map((f) => {
              const on = factIds.includes(f.id);
              return (
                <button key={f.id} type="button"
                  onClick={() => setFactIds((ids) => (on ? ids.filter((x) => x !== f.id) : [...ids, f.id]))}
                  className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-primary text-white" : "border bg-surface"}`}>
                  {f.year ?? ""} {f.title}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="해설 (선택)" rows={2} className="w-full rounded border bg-surface p-2 text-sm" />

      <button className="btn btn-primary w-full py-2.5" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="animate-spin" size={18} /> : <><Check size={18} /> {isEdit ? "수정 저장" : "문항 저장"}</>}
      </button>
    </div>
  );
}

function ChoiceImageButton({ index, onPick, has }: { index: number; onPick: (f: File | undefined) => void; has: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className="btn btn-outline px-2 py-1 text-xs">
        <ImagePlus size={14} /> 그림 {has ? "변경" : "추가"}
      </button>
      <input ref={ref} type="file" accept="image/*" className="hidden" data-choice={index}
        onChange={(e) => onPick(e.target.files?.[0])} />
    </>
  );
}
