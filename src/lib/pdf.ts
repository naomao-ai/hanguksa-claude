"use client";

/**
 * 클라이언트 전용 PDF 유틸 — pdfjs로 PDF를 페이지별 PNG 이미지로 변환한다.
 * AI 업로드는 Claude Vision(이미지)으로 분석하므로, PDF는 선택한 페이지를
 * 이미지로 렌더링해 기존 이미지 파이프라인에 그대로 흘려보낸다.
 */

// pdfjs는 브라우저에서만 로드 (SSR 회피를 위해 동적 import)
type PdfjsModule = typeof import("pdfjs-dist");
let _pdfjs: PdfjsModule | null = null;

async function getPdfjs(): Promise<PdfjsModule> {
  if (_pdfjs) return _pdfjs;
  const pdfjs = await import("pdfjs-dist");
  // 오프라인에서도 동작하도록 public/ 에 복사한 워커를 사용
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  _pdfjs = pdfjs;
  return pdfjs;
}

export interface RenderedPage {
  /** 1-base 페이지 번호 */
  page: number;
  /** image/png */
  media_type: string;
  /** base64 (data URL 접두사 제외) */
  data: string;
  /** 미리보기용 data URL */
  preview: string;
}

/** PDF 파일을 열어 총 페이지 수를 반환 */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await task.promise;
  const n = doc.numPages;
  await task.destroy();
  return n;
}

/**
 * 지정한 페이지 범위(1-base, 포함)를 PNG 이미지로 렌더링한다.
 * @param scale 렌더 배율 (기본 2.5 = 크롭 소스 고해상도. API 전송 시엔 별도 다운스케일)
 * @param onProgress (done, total) 진행 콜백
 */
export async function renderPdfPages(
  file: File,
  fromPage: number,
  toPage: number,
  scale = 2.5,
  onProgress?: (done: number, total: number) => void
): Promise<RenderedPage[]> {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await task.promise;

  const start = Math.max(1, fromPage);
  const end = Math.min(doc.numPages, toPage);
  const total = Math.max(0, end - start + 1);
  const out: RenderedPage[] = [];

  try {
    let done = 0;
    for (let p = start; p <= end; p++) {
      const pageObj = await doc.getPage(p);
      const viewport = pageObj.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas 컨텍스트를 생성할 수 없습니다.");
      await pageObj.render({ canvas, canvasContext: ctx, viewport }).promise;
      const dataUrl = canvas.toDataURL("image/png");
      out.push({
        page: p,
        media_type: "image/png",
        data: dataUrl.split(",")[1],
        preview: dataUrl,
      });
      pageObj.cleanup();
      done++;
      onProgress?.(done, total);
    }
  } finally {
    await task.destroy();
  }

  return out;
}
