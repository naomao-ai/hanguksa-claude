"use client";

import { useState } from "react";
import { ERAS, QUESTION_TYPES } from "@/lib/domain";
import type { AnalyzeResult, AnalyzedQuestion } from "@/lib/ai/schema";
import type { TokenUsage, ImageRole } from "@/lib/ai/claude";
import { getPdfPageCount, renderPdfPages } from "@/lib/pdf";
import { cropImageRegion, resolveFigureBox, resolveChoiceBox, downscaleForApi, splitColumns, getImageSize, loadInkMap, type NormalizedBox } from "@/lib/image";
import { snapChoiceBoxes } from "@/lib/snap";
import { AI_MODELS, DEFAULT_MODEL } from "@/lib/models";
import { Loader2, Sparkles, Check, Zap, FileText, ListChecks, Image as ImageIcon, FileType2, X } from "lucide-react";

type UploadImage = { name: string; media_type: string; data: string; preview: string; role: ImageRole; lowRes?: boolean };
/** 한 번에 분석 가능한 최대 이미지(PDF 페이지 포함) 수 */
const MAX_IMAGES = 20;
/** 원본 폭이 이보다 작으면 글자 인식 오류 가능성 경고 */
const LOW_RES_WIDTH = 1000;

/**
 * 이미지 1장을 업로드 항목으로 준비한다.
 * 2단 분할이 켜져 있고 문제지 role의 세로형(페이지형, h/w≥1.2) 이미지면
 * 좌/우 반으로 나눠 문항당 유효 해상도를 2배로 높인다.
 */
async function prepareImages(
  name: string,
  media_type: string,
  dataUrl: string,
  role: ImageRole,
  split: boolean
): Promise<UploadImage[]> {
  let width = 0;
  let height = 0;
  try {
    ({ width, height } = await getImageSize(dataUrl));
  } catch {
    // 크기를 못 읽어도 업로드는 진행
  }
  const lowRes = width > 0 && width < LOW_RES_WIDTH;
  if (split && role === "question" && width > 0 && height / width >= 1.2) {
    try {
      const { left, right } = await splitColumns(dataUrl);
      return [
        { name: `${name} (좌)`, media_type: "image/png", data: left.split(",")[1], preview: left, role, lowRes },
        { name: `${name} (우)`, media_type: "image/png", data: right.split(",")[1], preview: right, role, lowRes },
      ];
    } catch {
      // 분할 실패 시 원본 그대로
    }
  }
  return [{ name, media_type, data: dataUrl.split(",")[1], preview: dataUrl, role, lowRes }];
}

type PendingPdf = { name: string; file: File; role: ImageRole; numPages: number };

function isPdf(f: File): boolean {
  return f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
}

/** 관리자 전용: 기출 이미지 AI 분석 → 검수 → 저장 */
export default function UploadPanel({ onSaved }: { onSaved: (added: number) => void }) {
  const [images, setImages] = useState<UploadImage[]>([]);
  const [hint, setHint] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [error, setError] = useState<string | null>(null);
  // PDF 페이지 범위 선택 대기 상태
  const [pendingPdf, setPendingPdf] = useState<PendingPdf | null>(null);
  const [pageMode, setPageMode] = useState<"all" | "range">("all");
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ done: number; total: number } | null>(null);
  // 2단 시험지 좌/우 분할 (한능검 표준 지면 — 인식 해상도 2배)
  const [splitCols, setSplitCols] = useState(true);

  async function onFiles(files: FileList | null, role: ImageRole = "question") {
    if (!files) return;
    const list = Array.from(files);
    const pdf = list.find(isPdf);
    const imgFiles = list.filter((f) => !isPdf(f) && f.type.startsWith("image/"));

    // 이미지 파일은 즉시 base64로 읽고 (옵션) 2단 분할 후 추가
    if (imgFiles.length) {
      const read = await Promise.all(
        imgFiles.map(
          (f) =>
            new Promise<{ name: string; media_type: string; dataUrl: string }>((resolve) => {
              const reader = new FileReader();
              reader.onload = () =>
                resolve({ name: f.name, media_type: f.type || "image/png", dataUrl: reader.result as string });
              reader.readAsDataURL(f);
            })
        )
      );
      const arr: UploadImage[] = [];
      for (const r of read) {
        arr.push(...(await prepareImages(r.name, r.media_type, r.dataUrl, role, splitCols)));
      }
      setImages((prev) => [...prev, ...arr].slice(0, MAX_IMAGES));
    }

    // PDF는 페이지 수를 읽고 범위 선택 단계로 (한 번에 한 파일)
    if (pdf) {
      setError(null);
      try {
        const n = await getPdfPageCount(pdf);
        setPendingPdf({ name: pdf.name, file: pdf, role, numPages: n });
        setPageMode("all");
        setFromPage(1);
        setToPage(n);
      } catch {
        setError("PDF를 읽지 못했습니다. 파일이 손상되었거나 암호가 걸려 있을 수 있습니다.");
      }
    }
  }

  async function addPdfPages() {
    if (!pendingPdf) return;
    const from = pageMode === "all" ? 1 : Math.max(1, Math.min(fromPage, pendingPdf.numPages));
    const to = pageMode === "all" ? pendingPdf.numPages : Math.max(from, Math.min(toPage, pendingPdf.numPages));
    setPdfBusy(true);
    setError(null);
    setPdfProgress({ done: 0, total: to - from + 1 });
    try {
      const pages = await renderPdfPages(pendingPdf.file, from, to, 2.5, (done, total) => setPdfProgress({ done, total }));
      // (옵션) 각 페이지를 좌/우 2단 분할
      const processed: UploadImage[] = [];
      for (const p of pages) {
        processed.push(
          ...(await prepareImages(`${pendingPdf.name} (p.${p.page})`, p.media_type, p.preview, pendingPdf.role, splitCols))
        );
      }
      setImages((prev) => {
        const room = MAX_IMAGES - prev.length;
        const toAdd = processed.slice(0, Math.max(0, room));
        if (processed.length > toAdd.length) {
          setError(`이미지는 최대 ${MAX_IMAGES}장까지입니다. ${processed.length - toAdd.length}장이 제외되었습니다. 범위를 나눠 분석하세요.`);
        }
        return [...prev, ...toAdd].slice(0, MAX_IMAGES);
      });
      setPendingPdf(null);
    } catch {
      setError("PDF 페이지를 이미지로 변환하지 못했습니다.");
    } finally {
      setPdfBusy(false);
      setPdfProgress(null);
    }
  }

  function setRole(i: number, role: ImageRole) {
    setImages((prev) => prev.map((img, idx) => (idx === i ? { ...img, role } : img)));
  }

  async function analyze() {
    setAnalyzing(true);
    setError(null);
    setResult(null);
    setUsage(null);
    try {
      // 분석용 이미지는 다운스케일(JPEG)해 토큰·전송량을 줄인다.
      // 2단 분할된 세로형 컬럼(h/w>1.8)은 긴 변 한도를 2400으로 높여
      // 가로 해상도(글자 인식 품질)를 보존한다. 크롭 소스는 원본(preview) 그대로.
      const apiImages = await Promise.all(
        images.map(async (i) => {
          try {
            const { width, height } = await getImageSize(i.preview);
            const maxEdge = height > width * 1.8 ? 2400 : 1600;
            const d = await downscaleForApi(i.preview, maxEdge);
            return { media_type: d.media_type, data: d.data, role: i.role };
          } catch {
            return { media_type: i.media_type, data: i.data, role: i.role };
          }
        })
      );
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: apiImages, hint: hint || undefined, model }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석 실패");
      const { usage: u, ...rest } = data;
      // AI가 돌려준 그림 좌표(imageBox)로 원본 이미지에서 그림을 자동 크롭
      const questions = await Promise.all(
        (rest.questions ?? []).map(async (q: AnalyzedQuestion) => {
          let out: AnalyzedQuestion = q;
          const src = q.imageSourceIndex != null ? images[q.imageSourceIndex] : undefined;
          // 1) 발문(stem) 그림: 세로는 배점/보기 앵커로 정량 계산, 가로는 imageBox.
          //    questionBox(문항 영역) 안으로 클램프되어 2단 시험지에서 옆 단을 침범하지 않는다.
          const box = resolveFigureBox(q);
          if (box && src) {
            try {
              out = { ...out, imageUrl: await cropImageRegion(src.preview, box) };
            } catch {
              // 크롭 실패 시 아래 문항 영역 폴백 → 그것도 없으면 묘사(imageDescription)
            }
          }
          // 1-b) 좌표 폴백: 시각 자료가 있다는데 그림을 못 잘랐으면 문항 영역 전체를 크롭
          if (!out.imageUrl && q.imageDescription && q.questionBox && src) {
            const qbox = resolveChoiceBox(q.questionBox);
            if (qbox) {
              try {
                out = { ...out, imageUrl: await cropImageRegion(src.preview, qbox) };
              } catch {
                // 묘사(imageDescription)로 폴백
              }
            }
          }
          // 2) 그림 선지: 각 선지 그림을 원본에서 잘라 {text,imageUrl} 로 재구성.
          //    Vision 좌표의 계통 편차(아래로 갈수록 상향 밀림)를 잉크 분포로 스냅 보정한다.
          if (q.choiceKind === "image" && Array.isArray(q.choiceImages) && q.choiceImages.length) {
            const snapIdx =
              q.choiceImages.find((c) => c?.imageSourceIndex != null)?.imageSourceIndex ??
              q.imageSourceIndex ?? 0;
            const snapSrc = images[snapIdx];
            const boxes: (NormalizedBox | null)[] = q.choiceImages.map((cf) => cf?.imageBox ?? null);
            // 스냅된 좌표는 실제 픽셀로 검증된 값 — 같은 편차로 압축됐을 수 있는
            // questionBox 클램프를 적용하면 참 위치가 잘리므로 건너뛴다.
            const snappedAt = new Set<number>();
            if (snapSrc) {
              try {
                const ink = await loadInkMap(snapSrc.preview);
                const idxs: number[] = [];
                const subset: NormalizedBox[] = [];
                q.choiceImages.forEach((cf, ci) => {
                  const s = cf?.imageSourceIndex ?? snapIdx;
                  if (cf?.imageBox && s === snapIdx) {
                    idxs.push(ci);
                    subset.push(cf.imageBox);
                  }
                });
                const snapped = snapChoiceBoxes(ink, subset, q.questionBox);
                idxs.forEach((ci, k) => {
                  boxes[ci] = snapped[k];
                  snappedAt.add(ci);
                });
              } catch {
                // 스냅 실패 시 AI 원좌표 사용
              }
            }
            const cropped = await Promise.all(
              q.choiceImages.map(async (cf, i) => {
                const label = typeof q.choices[i] === "string" ? (q.choices[i] as string) : "";
                const csrc =
                  cf?.imageSourceIndex != null ? images[cf.imageSourceIndex] : src ?? images[0];
                const cbox = resolveChoiceBox(boxes[i], snappedAt.has(i) ? undefined : q.questionBox);
                if (cbox && csrc) {
                  try {
                    return { text: label, imageUrl: await cropImageRegion(csrc.preview, cbox) };
                  } catch {
                    return { text: label, imageUrl: null };
                  }
                }
                return { text: label, imageUrl: null };
              })
            );
            out = { ...out, choices: cropped };
          }
          return out;
        })
      );
      setResult({ ...rest, questions });
      if (u) setUsage(u);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    try {
      const res = await fetch("/api/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setResult(null);
      setImages([]);
      onSaved(data.created ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 중 오류");
    } finally {
      setSaving(false);
    }
  }

  function updateQuestion(i: number, patch: Partial<AnalyzedQuestion>) {
    if (!result) return;
    setResult({ ...result, questions: result.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)) });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-surface px-3 py-2.5 text-sm">
        <Sparkles size={16} className="text-primary" />
        <span className="font-medium">AI 모델</span>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded border bg-surface px-2 py-1">
          {AI_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.label} · {m.cost} · {m.note}</option>
          ))}
        </select>
        <span className="ml-auto text-xs text-muted">비용=입력/출력 per 1M 토큰</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label
          className="card flex cursor-pointer flex-col items-center gap-2 border-dashed p-6 text-center hover:border-primary/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files, "question"); }}
        >
          <FileText className="text-primary" />
          <span className="font-medium">문제지 업로드</span>
          <span className="text-xs text-muted">PDF 또는 이미지(PNG·JPG). PDF는 페이지 범위를 선택할 수 있습니다.</span>
          <input type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files, "question")} />
        </label>
        <label
          className="card flex cursor-pointer flex-col items-center gap-2 border-dashed p-6 text-center hover:border-accent/50"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); onFiles(e.dataTransfer.files, "answer"); }}
        >
          <ListChecks className="text-accent" />
          <span className="font-medium">답안지 업로드 <span className="text-xs font-normal text-muted">(선택)</span></span>
          <span className="text-xs text-muted">정답표 PDF·이미지. 첨부하면 AI가 정확한 정답을 매핑합니다.</span>
          <input type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files, "answer")} />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={splitCols} onChange={(e) => setSplitCols(e.target.checked)} className="accent-[var(--primary)]" />
        2단 시험지 좌/우 분할
        <span className="text-xs text-muted">— 전체 페이지 업로드 시 권장(인식 해상도 2배). 문항 하나만 잘라 올릴 땐 끄세요.</span>
      </label>

      {pendingPdf && (
        <div className="card space-y-3 border-primary/30 p-4">
          <div className="flex items-center gap-2">
            <FileType2 size={18} className="text-primary" />
            <span className="flex-1 truncate text-sm font-medium">{pendingPdf.name}</span>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{pendingPdf.numPages}페이지</span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium text-white ${pendingPdf.role === "answer" ? "bg-accent" : "bg-primary"}`}>
              {pendingPdf.role === "answer" ? "답안지" : "문제지"}
            </span>
            <button onClick={() => setPendingPdf(null)} className="text-muted hover:text-red-500"><X size={16} /></button>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={pageMode === "all"} onChange={() => setPageMode("all")} className="accent-[var(--primary)]" />
              전체 ({pendingPdf.numPages}페이지)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={pageMode === "range"} onChange={() => setPageMode("range")} className="accent-[var(--primary)]" />
              페이지 범위
            </label>
            {pageMode === "range" && (
              <span className="flex items-center gap-1.5">
                <input type="number" min={1} max={pendingPdf.numPages} value={fromPage}
                  onChange={(e) => setFromPage(Number(e.target.value))}
                  className="w-16 rounded border bg-surface px-2 py-1 text-center" />
                <span className="text-muted">~</span>
                <input type="number" min={1} max={pendingPdf.numPages} value={toPage}
                  onChange={(e) => setToPage(Number(e.target.value))}
                  className="w-16 rounded border bg-surface px-2 py-1 text-center" />
                <span className="text-xs text-muted">/ {pendingPdf.numPages}</span>
              </span>
            )}
          </div>

          {pdfProgress && (
            <div className="text-xs text-muted">페이지 변환 중… {pdfProgress.done}/{pdfProgress.total}</div>
          )}

          <button className="btn btn-primary w-full py-2" onClick={addPdfPages} disabled={pdfBusy}>
            {pdfBusy ? <><Loader2 className="animate-spin" size={16} /> 변환 중…</> : <><Check size={16} /> 선택 페이지 추가</>}
          </button>
        </div>
      )}

      {images.length > 0 && (
        <>
          <div className="flex items-center justify-between text-xs text-muted">
            <span>분석 대상 {images.length} / {MAX_IMAGES}장</span>
            <button onClick={() => setImages([])} className="hover:text-red-500">전체 비우기</button>
          </div>
          {images.some((i) => i.lowRes) && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              ⚠ 해상도가 낮은 이미지(원본 폭 {LOW_RES_WIDTH.toLocaleString()}px 미만)가 있어 글자 인식 오류 가능성이 있습니다. 가능하면 PDF나 더 큰 이미지를 사용하세요.
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt={img.name} className={`h-24 w-24 rounded-lg border-2 object-cover ${img.role === "answer" ? "border-accent" : "border-primary"}`} />
                {img.lowRes && (
                  <span className="absolute left-1 top-1 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-medium text-white">저해상</span>
                )}
                <button onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-xs text-white">×</button>
                <button
                  onClick={() => setRole(i, img.role === "answer" ? "question" : "answer")}
                  title="클릭하여 문제지/답안지 전환"
                  className={`absolute bottom-1 left-1 right-1 rounded px-1 py-0.5 text-[10px] font-medium text-white ${img.role === "answer" ? "bg-accent" : "bg-primary"}`}
                >
                  {img.role === "answer" ? "답안지" : "문제지"}
                </button>
              </div>
            ))}
          </div>
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="참고 정보 (예: 68회 심화) — 선택"
            className="w-full rounded-lg border bg-surface px-3 py-2 text-sm" />
          <button className="btn btn-primary w-full py-2.5" onClick={analyze} disabled={analyzing}>
            {analyzing ? <><Loader2 className="animate-spin" size={18} /> AI 분석 중…</> : <><Sparkles size={18} /> AI로 분석</>}
          </button>
        </>
      )}

      {error && <div className="card border-red-500/40 bg-red-500/10 p-3 text-sm text-red-600">{error}</div>}

      {usage && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2.5 text-sm">
          <Zap size={15} className="shrink-0 text-primary" />
          <span className="font-medium text-primary">토큰 사용량</span>
          <span className="text-muted">입력 <strong className="text-foreground">{usage.input_tokens.toLocaleString()}</strong></span>
          <span className="text-muted">출력 <strong className="text-foreground">{usage.output_tokens.toLocaleString()}</strong></span>
          <span className="text-muted">합계 <strong className="text-foreground">{usage.total_tokens.toLocaleString()}</strong></span>
          {usage.model && <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">모델: {usage.model}</span>}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">분석 결과 — {result.questions.length}문항 (검수 후 저장)</h3>
            <button className="btn btn-accent px-4 py-2" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />} 저장
            </button>
          </div>
          {result.questions.map((q, i) => (
            <div key={i} className="card space-y-2 p-4">
              <textarea value={q.stem} onChange={(e) => updateQuestion(i, { stem: e.target.value })} className="w-full rounded border bg-surface p-2 text-sm" rows={2} />
              {q.imageUrl && (
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={q.imageUrl} alt="추출한 그림" className="max-h-48 rounded-lg border" />
                  <button onClick={() => updateQuestion(i, { imageUrl: null })}
                    title="그림 제거 (좌표가 틀렸을 때)"
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-red-500 text-xs text-white">×</button>
                </div>
              )}
              {(q.imageDescription || q.imageDescription === "") && (
                <label className="flex items-start gap-1.5 rounded border border-accent/30 bg-accent/5 p-2 text-xs">
                  <ImageIcon size={14} className="mt-0.5 shrink-0 text-accent" />
                  <span className="flex-1">
                    <span className="mb-0.5 block font-medium text-accent">그림 묘사</span>
                    <textarea value={q.imageDescription ?? ""} onChange={(e) => updateQuestion(i, { imageDescription: e.target.value })}
                      className="w-full rounded border bg-surface p-1.5" rows={2} placeholder="시각 자료 묘사" />
                  </span>
                </label>
              )}
              <ol className="ml-4 list-decimal space-y-1 text-sm">
                {q.choices.map((c, ci) => {
                  const text = typeof c === "string" ? c : c.text;
                  const cImg = typeof c === "string" ? null : c.imageUrl;
                  return (
                    <li key={ci} className={ci === q.answerIndex ? "font-semibold text-primary" : ""}>
                      {text}
                      {cImg && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cImg} alt={`선지 ${ci + 1} 그림`} className="mt-1 max-h-32 rounded border" />
                      )}
                    </li>
                  );
                })}
              </ol>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <select value={q.era} onChange={(e) => updateQuestion(i, { era: e.target.value })} className="rounded border bg-surface px-2 py-1">
                  {ERAS.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}
                </select>
                <select value={q.qType} onChange={(e) => updateQuestion(i, { qType: e.target.value })} className="rounded border bg-surface px-2 py-1">
                  {QUESTION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <label className="flex items-center gap-1">정답
                  <select value={q.answerIndex} onChange={(e) => updateQuestion(i, { answerIndex: Number(e.target.value) })} className="rounded border bg-surface px-2 py-1">
                    {q.choices.map((_, ci) => <option key={ci} value={ci}>{ci + 1}번</option>)}
                  </select>
                </label>
                {q.answerSource && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${q.answerSource === "답지" ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"}`}>
                    {q.answerSource === "답지" ? "✓ 답지 확인" : "추정"}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
