import { describe, it, expect } from "vitest";
import { buildInkMap, contentBands, snapRowInBand, snapChoiceBoxes, type InkMap } from "./snap";
import type { NormalizedBox } from "./image";

// ---------- 합성 잉크 맵 도우미 ----------

function emptyInk(width: number, height: number): InkMap {
  return { data: new Uint8Array(width * height), width, height };
}

/** 정규화 상자 영역을 잉크(1)로 채운다 */
function fillRect(ink: InkMap, box: NormalizedBox) {
  const x1 = Math.round(box.x * ink.width);
  const y1 = Math.round(box.y * ink.height);
  const x2 = Math.round((box.x + box.width) * ink.width);
  const y2 = Math.round((box.y + box.height) * ink.height);
  for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) ink.data[y * ink.width + x] = 1;
}

function iou(a: NormalizedBox, b: NormalizedBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = a.width * a.height + b.width * b.height - inter;
  return union > 0 ? inter / union : 0;
}

// 78회 14번과 같은 3+2 격자 (참 위치 — 실측 프로파일 기반)
const TRUE_GRID: NormalizedBox[] = [
  { x: 0.05, y: 0.8, width: 0.09, height: 0.085 },
  { x: 0.17, y: 0.8, width: 0.09, height: 0.085 },
  { x: 0.29, y: 0.8, width: 0.09, height: 0.085 },
  { x: 0.1, y: 0.9, width: 0.09, height: 0.085 },
  { x: 0.24, y: 0.9, width: 0.09, height: 0.085 },
];

/** 참 격자 + (옵션) 발문 삽화가 그려진 잉크 맵 */
function pageInk(withIllustration: boolean): InkMap {
  const ink = emptyInk(400, 600);
  TRUE_GRID.forEach((b) => fillRect(ink, b));
  if (withIllustration) {
    // 발문 삽화: 넓고 빽빽한 잉크 블록 (실측 0.552~0.782 재현)
    fillRect(ink, { x: 0.04, y: 0.55, width: 0.4, height: 0.23 });
  }
  return ink;
}

const Q_BOX: NormalizedBox = { x: 0.03, y: 0.5, width: 0.45, height: 0.42 }; // AI questionBox (하단 압축 재현)

// ---------- 테스트 ----------

describe("buildInkMap", () => {
  it("어두운 픽셀만 잉크로 이진화한다", () => {
    const rgba = [0, 0, 0, 255, 255, 255, 255, 255]; // 검정, 흰색
    const ink = buildInkMap(rgba, 2, 1);
    expect(Array.from(ink.data)).toEqual([1, 0]);
  });
});

describe("contentBands — 행 프로파일 밴드 분할", () => {
  it("흰 띠로 구분된 콘텐츠 밴드를 찾는다 (삽화 + 2행 격자 = 3밴드)", () => {
    const ink = pageInk(true);
    const bands = contentBands(ink, 0.03, 0.42, 0.5, 1);
    expect(bands.length).toBe(3);
    // 마지막 두 밴드가 선지 행
    expect(bands[1].start).toBeCloseTo(0.8, 1);
    expect(bands[2].start).toBeCloseTo(0.9, 1);
  });

  it("빈 이미지에서는 밴드가 없다", () => {
    expect(contentBands(emptyInk(400, 600), 0, 1)).toEqual([]);
  });
});

describe("snapRowInBand — 밴드 내 행 단위 가로 배정", () => {
  it("run 개수가 상자 수와 일치하면 왼쪽부터 순서대로 1:1 배정한다", () => {
    const ink = pageInk(false);
    const band = { start: 0.8, end: 0.885 };
    // 행 전체가 왼쪽으로 0.06 압축된 상자들 (78회 실측: c2·c3가 같은 탑에 충돌하던 케이스)
    const row = TRUE_GRID.slice(0, 3).map((b) => ({ ...b, x: b.x - 0.06, y: 0.7 }));
    const snapped = snapRowInBand(ink, row, band);
    snapped.forEach((s, i) => {
      expect(iou(s, TRUE_GRID[i])).toBeGreaterThan(0.7);
    });
    // 서로 다른 열에 배정 (충돌 없음)
    expect(snapped[0].x).toBeLessThan(snapped[1].x);
    expect(snapped[1].x).toBeLessThan(snapped[2].x);
  });

  it("run이 없으면 세로만 밴드로 확정하고 가로는 원좌표 유지", () => {
    const ink = emptyInk(400, 600);
    const band = { start: 0.8, end: 0.885 };
    const row = [{ x: 0.05, y: 0.7, width: 0.09, height: 0.08 }];
    const snapped = snapRowInBand(ink, row, band);
    expect(snapped[0].x).toBe(0.05);
    expect(snapped[0].y).toBeCloseTo(0.8, 5);
  });
});

describe("snapChoiceBoxes — 격자 전체 보정", () => {
  // AI 좌표: 참 위치보다 0.12 위 (78회 실측 편차 재현 — 상자들이 삽화 위에 놓임)
  const AI_BOXES = TRUE_GRID.map((b) => ({ ...b, y: b.y - 0.12 }));

  it("잉크 함정(빽빽한 삽화)이 있어도 마지막 밴드 배정으로 참 위치를 찾는다 — 78회 회귀", () => {
    const ink = pageInk(true);
    const snapped = snapChoiceBoxes(ink, AI_BOXES, Q_BOX);
    snapped.forEach((s, i) => {
      expect(iou(s, TRUE_GRID[i])).toBeGreaterThan(0.7);
    });
  });

  it("삽화가 없어도 동일하게 동작한다", () => {
    const ink = pageInk(false);
    const snapped = snapChoiceBoxes(ink, AI_BOXES, Q_BOX);
    snapped.forEach((s, i) => {
      expect(iou(s, TRUE_GRID[i])).toBeGreaterThan(0.7);
    });
  });

  it("questionBox 없이도 동작한다", () => {
    const ink = pageInk(true);
    const snapped = snapChoiceBoxes(ink, AI_BOXES);
    snapped.forEach((s, i) => {
      expect(iou(s, TRUE_GRID[i])).toBeGreaterThan(0.7);
    });
  });

  it("밴드가 행 수보다 적으면(레이아웃 불성립) 원좌표 폴백", () => {
    const ink = emptyInk(400, 600); // 잉크 없음 → 밴드 0개
    const snapped = snapChoiceBoxes(ink, AI_BOXES, Q_BOX);
    expect(snapped).toEqual(AI_BOXES);
  });

  it("빈 배열은 그대로", () => {
    expect(snapChoiceBoxes(pageInk(true), [])).toEqual([]);
  });

  it("정위치 좌표는 거의 그대로 유지된다", () => {
    const ink = pageInk(true);
    const snapped = snapChoiceBoxes(ink, TRUE_GRID, Q_BOX);
    snapped.forEach((s, i) => {
      expect(iou(s, TRUE_GRID[i])).toBeGreaterThan(0.8);
    });
  });
});
