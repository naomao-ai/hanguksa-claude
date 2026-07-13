/**
 * 시험지 PDF → 페이지 PNG 렌더 (Claude Code 임포트 경로 1단계).
 *
 * pdfjs-dist legacy 빌드 + @napi-rs/canvas로 Node에서 렌더한다.
 * 웹 업로드(src/lib/pdf.ts, scale 2.5)와 동일 해상도, --split은 웹 splitColumns와
 * 동일하게 좌/우 0.51 폭(overlap 0.01)으로 나눠 문항당 해상도를 2배로 높인다.
 *
 * 사용:
 *   npm run render:exam -- <pdf경로> --out _import/79/pages [--scale 2.5] [--pages 1-13] [--split]
 */
import { createCanvas } from "@napi-rs/canvas";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const pdfPath = args.find((a) => !a.startsWith("--"));
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const outDir = opt("out");
const scale = Number(opt("scale") ?? 2.5);
const split = args.includes("--split");
const pagesArg = opt("pages"); // "1-13" | "3"

if (!pdfPath || !outDir) {
  console.error("사용법: npm run render:exam -- <pdf경로> --out <디렉터리> [--scale 2.5] [--pages 1-13] [--split]");
  process.exit(1);
}

// pdfjs-dist legacy는 Node에서 @napi-rs/canvas를 자동 사용한다.
// cMapUrl 등은 "URL 형식(끝 슬래시 포함)"을 요구하므로 Windows 경로를 file: URL로 변환.
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const { pathToFileURL } = await import("node:url");
const pdfjsRoot = path.join(process.cwd(), "node_modules", "pdfjs-dist");
const asDirUrl = (p: string) => pathToFileURL(p).href + "/";

const data = new Uint8Array(await readFile(pdfPath));
const doc = await pdfjs.getDocument({
  data,
  cMapUrl: asDirUrl(path.join(pdfjsRoot, "cmaps")),
  cMapPacked: true,
  standardFontDataUrl: asDirUrl(path.join(pdfjsRoot, "standard_fonts")),
}).promise;

let from = 1;
let to = doc.numPages;
if (pagesArg) {
  const m = pagesArg.match(/^(\d+)(?:-(\d+))?$/);
  if (m) {
    from = Math.max(1, Number(m[1]));
    to = Math.min(doc.numPages, Number(m[2] ?? m[1]));
  }
}

await mkdir(outDir, { recursive: true });
console.log(`${path.basename(pdfPath)}: ${doc.numPages}페이지 중 p${from}~p${to} 렌더 (scale ${scale}${split ? ", 2단 분할" : ""})`);

for (let p = from; p <= to; p++) {
  const page = await doc.getPage(p);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");
  await page.render({ canvas: canvas as never, canvasContext: ctx as never, viewport }).promise;
  const nn = String(p).padStart(2, "0");

  if (split) {
    // 좌/우 분할 (overlap 0.01 — 웹 splitColumns와 동일)
    const w = canvas.width;
    const colW = Math.round(w * 0.51);
    for (const [suffix, sx] of [["L", 0], ["R", w - colW]] as const) {
      const col = createCanvas(colW, canvas.height);
      col.getContext("2d").drawImage(canvas, sx, 0, colW, canvas.height, 0, 0, colW, canvas.height);
      const file = path.join(outDir, `p${nn}_${suffix}.png`);
      await writeFile(file, col.toBuffer("image/png"));
      console.log(`  ${file} (${colW}x${canvas.height})`);
    }
  } else {
    const file = path.join(outDir, `p${nn}.png`);
    await writeFile(file, canvas.toBuffer("image/png"));
    console.log(`  ${file} (${canvas.width}x${canvas.height})`);
  }
}
console.log("완료");
