import { describe, it, expect } from "vitest";
import { buildInkMap, contentBands, snapRowInBand, snapChoiceBoxes, snapFigureBand, type InkMap } from "./snap";
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

describe("snapFigureBand — 발문 삽화 크롭 박스 확정 (선지→위 스캔 + 잉크 가로)", () => {
  // 78회 #1 유형 지면: [헤더][발문 한 줄][삽화][선지 5줄]. 세로 전체.
  function figurePageInk(): InkMap {
    const ink = emptyInk(400, 800);
    fillRect(ink, { x: 0.1, y: 0.06, width: 0.6, height: 0.04 }); // 헤더(굵음)
    fillRect(ink, { x: 0.05, y: 0.15, width: 0.5, height: 0.012 }); // 발문 한 줄(얇음)
    fillRect(ink, { x: 0.08, y: 0.2, width: 0.62, height: 0.24 }); // 삽화(굵음·넓음) x0.08~0.70, y0.20~0.44
    [0.46, 0.49, 0.52, 0.55, 0.58].forEach((y) =>
      fillRect(ink, { x: 0.05, y, width: 0.4, height: 0.012 })
    ); // 선지 5줄(얇음)
    return ink;
  }
  // 모델 questionBox가 삽화 상단(0.20)을 자르고(y=0.28), imageBox도 좁고 아래로 밀린 상태
  const FIG_QBOX: NormalizedBox = { x: 0.03, y: 0.28, width: 0.72, height: 0.35 };
  const FIG_IMGBOX: NormalizedBox = { x: 0.2, y: 0.3, width: 0.3, height: 0.25 };

  it("선지 위로 스캔해 삽화 전체(발문 아래~선지 위)를 세로로 잡는다 (78회 #1)", () => {
    const box = snapFigureBand(figurePageInk(), FIG_IMGBOX, FIG_QBOX)!;
    expect(box).not.toBeNull();
    // 삽화(0.20~0.44) 전체 + 위/아래 여백 소폭. 발문(≤0.162)·선지(≥0.46) 제외.
    expect(box.y).toBeGreaterThan(0.162); // 발문 밴드 제외
    expect(box.y).toBeLessThan(0.2); // 삽화 잉크 위 여백까지 포함
    expect(box.y + box.height).toBeGreaterThan(0.44); // 삽화 아래 끝 포함
    expect(box.y + box.height).toBeLessThan(0.46); // 선지 top 침범 안 함
  });

  it("모델 imageBox가 좁아도 잉크로 삽화 실제 가로(0.08~0.70)를 찾는다", () => {
    const box = snapFigureBand(figurePageInk(), FIG_IMGBOX, FIG_QBOX)!;
    expect(box.x).toBeLessThan(0.15); // imageBox.x=0.2 보다 왼쪽(삽화 실제 좌단 0.08)
    expect(box.x + box.width).toBeGreaterThan(0.6); // 삽화 실제 우단(0.70)까지
  });

  it("questionBox가 삽화 상단을 잘라도 박스 top은 삽화 실제 상단을 넘어간다", () => {
    const box = snapFigureBand(figurePageInk(), FIG_IMGBOX, FIG_QBOX)!;
    expect(box.y).toBeLessThan(FIG_QBOX.y); // < 0.28
  });

  it("가로는 questionBox 단(컬럼) 안으로 클램프된다 (2단 침범 방지)", () => {
    const box = snapFigureBand(figurePageInk(), FIG_IMGBOX, FIG_QBOX)!;
    expect(box.x).toBeGreaterThanOrEqual(FIG_QBOX.x);
    expect(box.x + box.width).toBeLessThanOrEqual(FIG_QBOX.x + FIG_QBOX.width);
  });

  it("삽화가 짧아 발문이 maxHeight 안에 들어와도 발문 텍스트를 제외한다 (78회 #2 유형)", () => {
    const ink = emptyInk(400, 800);
    fillRect(ink, { x: 0.05, y: 0.6, width: 0.5, height: 0.012 }); // 발문 줄1
    fillRect(ink, { x: 0.05, y: 0.618, width: 0.4, height: 0.012 }); // 발문 줄2
    fillRect(ink, { x: 0.08, y: 0.65, width: 0.6, height: 0.15 }); // 삽화(칠판) 0.65~0.80
    [0.82, 0.85, 0.88, 0.91, 0.94].forEach((y) =>
      fillRect(ink, { x: 0.05, y, width: 0.4, height: 0.012 })
    ); // 선지 5줄
    // 모델 imageBox는 선지 근처로 밀린 상태(#2 실측 재현)
    const box = snapFigureBand(ink, { x: 0.19, y: 0.83, width: 0.6, height: 0.11 }, { x: 0.04, y: 0.8, width: 0.9, height: 0.16 })!;
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThan(0.63); // 발문(≤0.63) 제외
    expect(box.y).toBeLessThan(0.65); // 삽화 위 여백까지만
    expect(box.y + box.height).toBeGreaterThan(0.8); // 삽화 아래 끝 포함
    expect(box.y + box.height).toBeLessThan(0.82); // 선지 침범 안 함
  });

  it("그림 선지(굵은 이미지 밴드 격자)면 얇은 클러스터가 없어 null → 폴백", () => {
    const ink = pageInk(true); // 굵은 격자(h0.085) — 얇은 선지 아님
    const modelBox = { x: 0.04, y: 0.55, width: 0.4, height: 0.23 };
    expect(snapFigureBand(ink, modelBox, Q_BOX)).toBeNull();
  });

  it("선지 클러스터를 못 찾으면 null", () => {
    const ink = emptyInk(400, 800);
    fillRect(ink, { x: 0.08, y: 0.2, width: 0.5, height: 0.24 }); // 삽화만, 선지 없음
    const modelBox = { x: 0.1, y: 0.3, width: 0.5, height: 0.25 };
    expect(snapFigureBand(ink, modelBox, FIG_QBOX)).toBeNull();
  });

  it("그림 선지 문항: 그림보다 한참 아래의 다음 문항 선지는 무시하고 폴백(null)", () => {
    const ink = emptyInk(400, 800);
    fillRect(ink, { x: 0.1, y: 0.2, width: 0.6, height: 0.14 }); // 스템 삽화(굵음)
    [0.1, 0.3, 0.5].forEach((x) => fillRect(ink, { x, y: 0.37, width: 0.15, height: 0.11 })); // 그림 선지 격자(굵음)
    [0.78, 0.81, 0.84, 0.87].forEach((y) => fillRect(ink, { x: 0.1, y, width: 0.4, height: 0.012 })); // 다음 문항 선지
    const imageBox = { x: 0.1, y: 0.2, width: 0.6, height: 0.14 };
    // 다음 문항 선지(0.78)는 그림(0.20~0.34)보다 0.2 넘게 아래 → 폴백
    expect(snapFigureBand(ink, imageBox, { x: 0.05, y: 0.15, width: 0.7, height: 0.4 })).toBeNull();
  });

  it("글로만 된 긴 삽화(굵은 밴드 없음)도 본문을 잡고 발문·선지는 제외 (78회 #24 책 유형)", () => {
    const ink = emptyInk(400, 900);
    // 헤더·발문 얇은 줄들이 책 본문과 촘촘히 이어져 하나의 run → imageBox.y-0.05 위에서
    // 시작하므로 선지로 오인되지 않는다(실측 #24 재현).
    [0.04, 0.065, 0.09].forEach((y) => fillRect(ink, { x: 0.1, y, width: 0.4, height: 0.012 }));
    // 책 본문: 긴 텍스트(굵은 밴드 없음), 0.12~0.402, 줄 간격 ~0.018
    [0.12, 0.15, 0.18, 0.21, 0.24, 0.27, 0.3, 0.33, 0.36, 0.39].forEach((y) =>
      fillRect(ink, { x: 0.1, y, width: 0.5, height: 0.012 })
    );
    // 선지 5줄: 촘촘(간격 0.008 > minGap), 책과는 큰 간격(0.058)으로 분리
    [0.46, 0.478, 0.496, 0.514, 0.532].forEach((y) =>
      fillRect(ink, { x: 0.05, y, width: 0.4, height: 0.01 })
    );
    const box = snapFigureBand(ink, { x: 0.1, y: 0.12, width: 0.5, height: 0.3 }, { x: 0.03, y: 0.1, width: 0.6, height: 0.45 })!;
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThan(0.102); // 발문(≤0.102) 제외
    expect(box.y + box.height).toBeGreaterThan(0.39); // 책 아래 끝 포함
    expect(box.y + box.height).toBeLessThan(0.46); // 선지 제외
  });
});
