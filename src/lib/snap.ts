/**
 * 그림 선지 좌표 스냅 보정.
 *
 * Vision 모델의 정규화 좌표는 페이지 아래쪽으로 갈수록 위로 밀리는 계통적
 * 편차가 관측된다(78회 4쪽 실측: 선지 격자가 약 0.11~0.12 상향 → 상자가
 * 발문 삽화 위에 놓임). 커버리지 점수 최대화는 빽빽한 삽화에 끌려가는
 * 함정이 실측으로 확인되어, 대신 결정적 밴드 분할을 쓴다:
 *
 *   1. 격자 x-범위의 행 잉크 프로파일에서 흰 띠로 구분되는 콘텐츠 밴드를 찾고
 *   2. "선지 격자는 문항의 마지막 콘텐츠"라는 시험지 레이아웃 불변식에 따라
 *      마지막 R개(행 수) 밴드를 선지 행으로 배정한 뒤
 *   3. 각 상자의 세로를 밴드로 확정하고 가로만 열 프로파일로 조인다.
 *
 * 밴드가 행 수보다 적으면(레이아웃 가정 불성립) 원좌표로 폴백한다.
 * 모든 함수는 DOM 없이 동작하는 순수 로직(테스트 가능). 픽셀 추출은
 * image.ts의 loadInkMap(canvas)이 담당한다.
 */

import type { NormalizedBox } from "./image";

/** 이진 잉크 맵: 콘텐츠 픽셀=1, 배경=0 */
export interface InkMap {
  data: Uint8Array;
  width: number;
  height: number;
}

/** 세로 콘텐츠 밴드 (정규화 y) */
export interface Band {
  start: number;
  end: number;
}

/** RGBA 배열 → 잉크 맵. 밝은 배경(시험지) 기준 임계값으로 이진화 */
export function buildInkMap(
  rgba: Uint8ClampedArray | Uint8Array | number[],
  width: number,
  height: number,
  threshold = 200
): InkMap {
  const data = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    const a = rgba[i * 4 + 3];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    data[i] = a > 40 && lum < threshold ? 1 : 0;
  }
  return { data, width, height };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * x-범위 [x, x+width]의 행 잉크 밀도 프로파일에서 콘텐츠 밴드를 찾는다.
 * 밀도 > onThreshold 인 행이 콘텐츠, 그 미만이 여백이며,
 * 아주 얇은 여백(minGap 미만)으로 나뉜 밴드는 하나로 합친다.
 */
export function contentBands(
  ink: InkMap,
  x: number,
  width: number,
  yFrom = 0,
  yTo = 1,
  onThreshold = 0.02,
  minGap = 0.005
): Band[] {
  const x1 = Math.max(0, Math.round(clamp01(x) * ink.width));
  const x2 = Math.min(ink.width, Math.round(clamp01(x + width) * ink.width));
  const y1 = Math.max(0, Math.round(clamp01(yFrom) * ink.height));
  const y2 = Math.min(ink.height, Math.round(clamp01(yTo) * ink.height));
  if (x2 - x1 < 2 || y2 - y1 < 2) return [];

  const bands: Band[] = [];
  let start = -1;
  for (let y = y1; y <= y2; y++) {
    let on = false;
    if (y < y2) {
      let cnt = 0;
      const row = y * ink.width;
      for (let px = x1; px < x2; px++) cnt += ink.data[row + px];
      on = cnt / (x2 - x1) > onThreshold;
    }
    if (on && start < 0) start = y;
    if (!on && start >= 0) {
      bands.push({ start: start / ink.height, end: y / ink.height });
      start = -1;
    }
  }
  // 얇은 여백으로 나뉜 밴드 병합
  const merged: Band[] = [];
  for (const b of bands) {
    const last = merged[merged.length - 1];
    if (last && b.start - last.end < minGap) last.end = b.end;
    else merged.push({ ...b });
  }
  return merged;
}

/** 밴드 내 x-창의 열 잉크 프로파일에서 연속 구간(run) 목록 — 정규화 x 단위 */
function columnRuns(ink: InkMap, xFrom: number, xTo: number, band: Band): Band[] {
  const x1 = Math.max(0, Math.round(clamp01(xFrom) * ink.width));
  const x2 = Math.min(ink.width, Math.round(clamp01(xTo) * ink.width));
  const y1 = Math.max(0, Math.round(clamp01(band.start) * ink.height));
  const y2 = Math.min(ink.height, Math.round(clamp01(band.end) * ink.height));
  if (x2 - x1 < 4 || y2 - y1 < 4) return [];

  const cols = new Array<number>(x2 - x1).fill(0);
  for (let y = y1; y < y2; y++) {
    const row = y * ink.width;
    for (let px = x1; px < x2; px++) if (ink.data[row + px]) cols[px - x1]++;
  }
  const threshold = (y2 - y1) * 0.08; // 열 임계: 밴드 높이의 8% 이상 잉크
  const runs: Band[] = [];
  let start = -1;
  for (let i = 0; i <= cols.length; i++) {
    const on = i < cols.length && cols[i] > threshold;
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      runs.push({ start: (x1 + start) / ink.width, end: (x1 + i) / ink.width });
      start = -1;
    }
  }
  return runs;
}

/**
 * 한 행의 상자들을 밴드에 배정하고 가로를 정한다.
 * 행 전체 x-창의 열 프로파일에서 "넓은" run(≥ 평균 상자폭 35% — 마커
 * 숫자·잡티 제거)을 찾아, 개수가 상자 수와 일치하면 왼쪽부터 순서대로
 * 1:1 배정한다(상자별 독립 스냅은 이웃 사진과 충돌하는 것이 실측으로
 * 확인됨). 일치하지 않으면 상자별 최대 겹침 run으로 폴백하고,
 * 그것도 없으면 가로는 원좌표를 유지한다.
 */
export function snapRowInBand(ink: InkMap, rowBoxes: NormalizedBox[], band: Band): NormalizedBox[] {
  const sorted = rowBoxes.map((b, i) => ({ b, i })).sort((p, q) => p.b.x - q.b.x);
  const avgW = rowBoxes.reduce((s, b) => s + b.width, 0) / rowBoxes.length;
  const xFrom = sorted[0].b.x - avgW * 0.5;
  const xTo = sorted[sorted.length - 1].b.x + sorted[sorted.length - 1].b.width + avgW * 0.5;

  const runs = columnRuns(ink, xFrom, xTo, band);
  const wide = runs.filter((r) => r.end - r.start >= avgW * 0.35);

  const out: NormalizedBox[] = rowBoxes.map((b) => ({
    x: b.x,
    y: band.start,
    width: b.width,
    height: band.end - band.start,
  }));

  if (wide.length === rowBoxes.length) {
    // 순서 배정: k번째 상자(x순) ← k번째 run
    sorted.forEach((p, k) => {
      out[p.i] = { x: wide[k].start, y: band.start, width: wide[k].end - wide[k].start, height: band.end - band.start };
    });
  } else {
    // 폴백: 상자별 최대 겹침 run
    rowBoxes.forEach((b, i) => {
      let best: Band | null = null;
      let bestOv = 0;
      for (const r of wide.length ? wide : runs) {
        const ov = Math.min(r.end, b.x + b.width) - Math.max(r.start, b.x);
        if (ov > bestOv) {
          bestOv = ov;
          best = r;
        }
      }
      if (best && best.end - best.start >= b.width * 0.3) {
        out[i] = { x: best.start, y: band.start, width: best.end - best.start, height: band.end - band.start };
      }
    });
  }
  return out;
}

/**
 * 그림 선지 격자 전체 보정.
 * 상자들을 행으로 묶고, 문항 영역의 콘텐츠 밴드 중 마지막 행수만큼을
 * 선지 행으로 배정한다(선지는 문항의 마지막 콘텐츠). 배정 실패 시 원좌표.
 */
export function snapChoiceBoxes(
  ink: InkMap,
  boxes: NormalizedBox[],
  questionBox?: NormalizedBox | null
): NormalizedBox[] {
  if (!boxes.length) return boxes;

  // 행 그룹 (원본 인덱스 유지)
  const order = boxes.map((_, i) => i).sort((a, b) => boxes[a].y - boxes[b].y);
  const rows: number[][] = [];
  for (const i of order) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(boxes[i].y - boxes[last[0]].y) <= boxes[last[0]].height * 0.5) last.push(i);
    else rows.push([i]);
  }

  const avgH = boxes.reduce((s, b) => s + b.height, 0) / boxes.length;
  const minX = Math.min(...boxes.map((b) => b.x));
  const maxR = Math.max(...boxes.map((b) => b.x + b.width));
  // 탐색 세로 범위: 문항 영역(있으면) + 하단 여유(좌표 압축 보정)
  const yFrom = questionBox ? clamp01(questionBox.y) : clamp01(Math.min(...boxes.map((b) => b.y)) - 0.1);
  const yTo = questionBox ? clamp01(questionBox.y + questionBox.height + 0.1) : 1;

  const bands = contentBands(ink, minX, maxR - minX, yFrom, yTo).filter(
    (b) => b.end - b.start >= avgH * 0.5
  );
  if (bands.length < rows.length) return boxes; // 레이아웃 가정 불성립 → 원좌표

  const chosen = bands.slice(-rows.length);
  const out = boxes.map((b) => ({ ...b }));
  rows.forEach((rowIdx, r) => {
    const snapped = snapRowInBand(ink, rowIdx.map((i) => boxes[i]), chosen[r]);
    rowIdx.forEach((i, k) => {
      out[i] = snapped[k];
    });
  });
  return out;
}
