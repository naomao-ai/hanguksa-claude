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

/** snapFigureBand 파라미터 (지면 배치 상수) */
export interface FigureBandOptions {
  /** 이보다 얇은 밴드는 텍스트 줄(발문·선지)로 본다 */
  thinMax?: number;
  /** 밴드 병합 허용 최대 흰 띠 간격 */
  gapMax?: number;
  /** 삽화 세로 최대 높이 — 위로 병합이 발문·이전 문항을 삼키는 것을 막는 상한 */
  maxHeight?: number;
  /** 유효한 삽화로 인정하는 최소 높이 */
  minHeight?: number;
}

/** 세로 범위 [yStart,yEnd]에서 잉크가 있는 가로 범위(정규화)를 찾는다. */
function inkColumnExtent(
  ink: InkMap,
  xFrom: number,
  xTo: number,
  yStart: number,
  yEnd: number,
  onThreshold = 0.03
): { x: number; width: number } | null {
  const x1 = Math.max(0, Math.round(clamp01(xFrom) * ink.width));
  const x2 = Math.min(ink.width, Math.round(clamp01(xTo) * ink.width));
  const y1 = Math.max(0, Math.round(clamp01(yStart) * ink.height));
  const y2 = Math.min(ink.height, Math.round(clamp01(yEnd) * ink.height));
  if (x2 - x1 < 2 || y2 - y1 < 2) return null;
  const rows = y2 - y1;
  let left = -1;
  let right = -1;
  for (let px = x1; px < x2; px++) {
    let cnt = 0;
    for (let y = y1; y < y2; y++) cnt += ink.data[y * ink.width + px];
    if (cnt / rows > onThreshold) {
      if (left < 0) left = px;
      right = px;
    }
  }
  if (left < 0) return null;
  return { x: left / ink.width, width: (right - left + 1) / ink.width };
}

/**
 * 발문 삽화의 크롭 박스를 잉크 밴드로 확정한다 (사용자 규칙: 배점 아래 ~ 보기 위).
 *
 * 한능검 지면은 [발문 텍스트] → [삽화/자료] → [선지]의 세로 구조가 불변이다.
 * Vision 모델의 좌표(scoreMarkerY·choicesTopY·imageBox·questionBox)에는 계통 편차가
 * 있어(78회 실측: 크롭이 삽화를 벗어나 선지·다음 문항까지 삼킴), 특히 위쪽 경계
 * (questionBox.y)가 삽화 상단을 잘라내고 imageBox가 넓은 삽화를 좁게 잡는다. 그래서
 * 모델 좌표는 "이 문항이 페이지 어디쯤"이라는 위치 힌트로만 쓰고 경계는 픽셀에서 뽑는다:
 *
 *   1. 문항 x-범위의 행 잉크 프로파일에서 (세로 전체에 대해) 밴드를 구한다.
 *   2. imageBox 아래 근처에서 시작하는 "얇은 밴드 ≥3개 연속" = 선지 격자 → 그 top이
 *      choicesTop(그림의 아래 끝). 지면에서 가장 신뢰할 수 있는 픽셀 앵커.
 *   3. 선지 바로 위 밴드부터 위로 병합하되, (choicesTop − 밴드top)이 maxHeight를 넘거나
 *      흰 띠 간격이 gapMax를 넘으면 멈춘다 → 발문 바로 아래(삽화의 위 끝). 상한이 빽빽한
 *      지면에서 발문·이전 문항까지 삼키는 것을 막는다. 밴드는 흰 여백 쪽으로 소폭 확장해
 *      삽화 테두리·둥근 모서리까지 담는다.
 *   4. 확정한 세로 범위의 열 잉크 분포로 가로 범위까지 찾아 questionBox 단 안으로 클램프.
 *
 * 선지 클러스터(얇은 밴드 연속)를 못 찾으면(예: 그림 선지 문항 — 선지가 굵은 이미지
 * 밴드) null을 돌려 호출부가 모델 앵커로 폴백하게 한다.
 */
export function snapFigureBand(
  ink: InkMap,
  imageBox: NormalizedBox,
  questionBox?: NormalizedBox | null,
  opts: FigureBandOptions = {}
): NormalizedBox | null {
  const thinMax = opts.thinMax ?? 0.02;
  const gapMax = opts.gapMax ?? 0.06;
  const maxHeight = opts.maxHeight ?? 0.3;
  const minHeight = opts.minHeight ?? 0.03;

  const xFrom = questionBox ? clamp01(questionBox.x) : clamp01(imageBox.x - 0.08);
  const xTo = questionBox
    ? clamp01(questionBox.x + questionBox.width)
    : clamp01(imageBox.x + imageBox.width + 0.08);
  if (xTo - xFrom < 0.02) return null;

  // 세로 전체(0~1) — questionBox 위쪽이 삽화를 잘라도 상단을 볼 수 있게
  const bands = contentBands(ink, xFrom, xTo - xFrom, 0, 1);
  if (bands.length < 2) return null;

  // 선지 클러스터: imageBox 아래 근처에서 "촘촘히"(간격 ≤ choiceGap) 연속된 얇은 밴드
  // ≥3개. 간격이 크면 다른 문항/섹션이므로 한 클러스터로 묶지 않는다. imageBox.y-0.05
  // 위에서 시작하는 run은 제외(발문 위 삽화 본문이 이 위에서 시작하면 걸러짐).
  const choiceGap = 0.03;
  let clusterStart = -1;
  let runStart = -1;
  let runLen = 0;
  const accept = () => runLen >= 3 && bands[runStart].start > imageBox.y - 0.05;
  for (let i = 0; i < bands.length; i++) {
    const thin = bands[i].end - bands[i].start < thinMax;
    if (thin && runStart >= 0 && bands[i].start - bands[i - 1].end > choiceGap) {
      if (accept()) { clusterStart = runStart; break; }
      runStart = i;
      runLen = 1;
    } else if (thin) {
      if (runStart < 0) runStart = i;
      runLen++;
    } else {
      if (accept()) { clusterStart = runStart; break; }
      runStart = -1;
      runLen = 0;
    }
  }
  if (clusterStart < 0 && accept()) clusterStart = runStart;
  if (clusterStart <= 0) return null;

  const choicesTop = bands[clusterStart].start;
  // 찾은 클러스터가 이 문항 그림보다 한참 아래면(그림 선지 문항이라 자기 선지가 없어
  // 다음 문항 선지를 잡은 경우) 폴백한다.
  if (choicesTop - (imageBox.y + imageBox.height) > 0.2) return null;

  // 선지 바로 위 밴드부터 위로 병합 (상한·간격 제한) → 문항 콘텐츠 영역
  let topIdx: number | null = null;
  for (let i = clusterStart - 1; i >= 0; i--) {
    if (choicesTop - bands[i].start > maxHeight) break;
    if (i < clusterStart - 1 && bands[i + 1].start - bands[i].end > gapMax) break;
    topIdx = i;
  }
  if (topIdx === null) return null;

  // 발문 제외: 삽화 본체 = 영역 안 첫 "굵은" 밴드. 그 위의 얇은 밴드는 삽화에 밀착이면
  // (테두리·둥근 모서리) 포함하고, 흰 띠로 떨어져 있으면 발문 텍스트로 보고 제외한다.
  // (삽화가 짧으면 maxHeight 상한만으로는 발문이 안 걸러지므로 이 단계가 필요.)
  // 굵은 밴드가 없는 삽화(글로만 된 책·사료)는 텍스트 줄 사이 간격이 넓으므로 병합
  // 간격(tightGap)을 키워 본문 전체를 잡고, 발문 제외는 maxHeight 상한에 맡긴다.
  const minThick = 0.03;
  let hasThick = false;
  let figIdx = clusterStart - 1;
  for (let i = topIdx; i <= clusterStart - 1; i++) {
    if (bands[i].end - bands[i].start >= minThick) {
      figIdx = i;
      hasThick = true;
      break;
    }
  }
  const tightGap = hasThick ? 0.012 : 0.03;
  for (let i = figIdx - 1; i >= topIdx; i--) {
    if (bands[i + 1].start - bands[i].end > tightGap) break;
    figIdx = i;
  }

  // 세로: 밴드는 잉크에 딱 붙으므로 위/아래 흰 여백(테두리·둥근 모서리) 쪽으로 소폭
  // 확장한다 — 이웃 밴드(위=발문, 아래=선지)의 절반 지점까지만(최대 pad).
  const pad = 0.02;
  const topBand = bands[figIdx];
  const aboveEnd = figIdx > 0 ? bands[figIdx - 1].end : 0;
  const bottomInk = bands[clusterStart - 1].end; // 선지 바로 위 = 삽화 아래 끝
  const y = clamp01(topBand.start - Math.min(pad, (topBand.start - aboveEnd) / 2));
  const yEnd = clamp01(bottomInk + Math.min(pad, (choicesTop - bottomInk) / 2));
  if (yEnd - y < minHeight) return null;

  // 가로: 세로 범위의 열 잉크 분포로 삽화 실제 가로를 찾는다(넓은 프레임·기자 포함).
  // 검출 실패 시 imageBox. 항상 questionBox 단 안으로 클램프(2단 옆 단 침범 방지).
  const ext = inkColumnExtent(ink, xFrom, xTo, y, yEnd);
  let x: number;
  let xRight: number;
  if (ext && ext.width > 0.1) {
    x = clamp01(ext.x - 0.01);
    xRight = clamp01(ext.x + ext.width + 0.01);
  } else {
    x = clamp01(imageBox.x - 0.02);
    xRight = clamp01(imageBox.x + imageBox.width + 0.02);
  }
  if (questionBox) {
    x = Math.max(x, clamp01(questionBox.x + 0.005));
    xRight = Math.min(xRight, clamp01(questionBox.x + questionBox.width - 0.005));
  }
  if (xRight - x < 0.02) return null;

  return { x, y, width: xRight - x, height: yEnd - y };
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
