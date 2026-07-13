/**
 * Node용 이미지 픽셀 어댑터 — src/lib/image.ts의 브라우저 canvas 함수들을
 * @napi-rs/canvas(설치됨: pdfjs-dist optional dep)로 미러한다.
 *
 * Claude Code 임포트 경로(scripts/import-exam.ts)에서 잉크맵 생성·크롭에 사용.
 * 좌표계·임계값·다운스케일 폭(700px)은 웹 파이프라인과 동일하게 유지한다.
 *
 * 실행 관례: node --experimental-strip-types (import는 상대경로 + .ts 확장자)
 */
import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";
import { readFile } from "node:fs/promises";
import { buildInkMap, type InkMap } from "../../src/lib/snap.ts";
import type { NormalizedBox } from "../../src/lib/image.ts";

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

async function loadImageFile(path: string): Promise<Image> {
  return loadImage(await readFile(path));
}

/** 이미지 파일 → 이진 잉크맵 (src/lib/image.ts loadInkMap 미러, 기본 폭 700px) */
export async function loadInkMapFromFile(path: string, targetWidth = 700): Promise<InkMap> {
  const img = await loadImageFile(path);
  const scale = Math.min(1, targetWidth / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h);
  return buildInkMap(px.data, w, h);
}

/**
 * 이미지 파일에서 정규화 경계상자 영역을 잘라 PNG data URL로 반환
 * (src/lib/image.ts cropImageRegion 미러 — 최소 크기 4px 거부 동일)
 */
export async function cropRegionToDataUrl(path: string, box: NormalizedBox): Promise<string> {
  const img = await loadImageFile(path);
  const x = clamp01(box.x) * img.width;
  const y = clamp01(box.y) * img.height;
  const w = clamp01(box.width) * img.width;
  const h = clamp01(box.height) * img.height;
  if (w < 4 || h < 4) throw new Error("crop 영역이 너무 작습니다.");
  const canvas = createCanvas(Math.round(w), Math.round(h));
  canvas.getContext("2d").drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return `data:image/png;base64,${canvas.toBuffer("image/png").toString("base64")}`;
}

/** data URL → PNG Buffer (dry-run 미리보기 저장용) */
export function dataUrlToBuffer(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

/** 이미지 파일의 픽셀 크기 */
export async function getImageFileSize(path: string): Promise<{ width: number; height: number }> {
  const img = await loadImageFile(path);
  return { width: img.width, height: img.height };
}
