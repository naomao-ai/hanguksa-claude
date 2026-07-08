import { describe, it, expect } from "vitest";
import { resolveFigureBox, resolveChoiceBox, clampBoxWithin } from "./image";

// resolveFigureBox / resolveChoiceBox 는 DOM을 쓰지 않는 순수 함수라 노드에서 검증 가능.
// (cropImageRegion/downscaleForApi 는 canvas 의존이라 여기서 다루지 않음)

describe("resolveFigureBox — stem 그림 세로 앵커", () => {
  it("배점 아래~보기 위 앵커로 세로 범위를 잡고 텍스트를 제외한다", () => {
    const box = resolveFigureBox({
      imageBox: { x: 0.2, y: 0.1, width: 0.6, height: 0.5 },
      scoreMarkerY: 0.3,
      choicesTopY: 0.7,
    });
    expect(box).not.toBeNull();
    // 세로는 앵커 우선(±VERTICAL_MARGIN 0.008)
    expect(box!.y).toBeCloseTo(0.308, 3);
    expect(box!.y + box!.height).toBeCloseTo(0.692, 3);
    // 가로는 imageBox ± SAFE_PADDING(0.02)
    expect(box!.x).toBeCloseTo(0.18, 3);
  });

  it("앵커가 없으면 imageBox 전체에 ±2% 패딩으로 폴백한다", () => {
    const box = resolveFigureBox({ imageBox: { x: 0.2, y: 0.2, width: 0.5, height: 0.5 } });
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(0.18, 3);
    expect(box!.y).toBeCloseTo(0.18, 3);
    expect(box!.width).toBeCloseTo(0.54, 3);
    expect(box!.height).toBeCloseTo(0.54, 3);
  });

  it("좌표가 전혀 없으면 null", () => {
    expect(resolveFigureBox({})).toBeNull();
  });
});

describe("resolveChoiceBox — 그림 선지 크롭 박스", () => {
  it("선지 imageBox에 안전 패딩을 적용한다", () => {
    const box = resolveChoiceBox({ x: 0.1, y: 0.7, width: 0.15, height: 0.15 });
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(0.08, 3);
    expect(box!.y).toBeCloseTo(0.68, 3);
    expect(box!.width).toBeCloseTo(0.19, 3);
    expect(box!.height).toBeCloseTo(0.19, 3);
  });

  it("경계(0/1)를 넘지 않도록 클램프한다", () => {
    const box = resolveChoiceBox({ x: 0, y: 0.9, width: 0.2, height: 0.2 });
    expect(box!.x).toBe(0); // 0 - 0.02 → clamp 0
    expect(box!.y + box!.height).toBeLessThanOrEqual(1);
  });

  it("null/undefined 는 null 반환", () => {
    expect(resolveChoiceBox(null)).toBeNull();
    expect(resolveChoiceBox(undefined)).toBeNull();
  });

  it("아주 작은 상자도 안전 패딩으로 최소 크기가 확보된다(검수에서 사람이 보정)", () => {
    // ±2% 패딩이 사방에 더해져 0.001 → 약 0.041 로 부풀려짐. 크롭 자체는 성립.
    const box = resolveChoiceBox({ x: 0.5, y: 0.5, width: 0.001, height: 0.001 });
    expect(box).not.toBeNull();
    expect(box!.width).toBeCloseTo(0.041, 3);
  });

  it("한 줄 5개 선지 격자를 각각 잘라낼 수 있다", () => {
    // ①②③④⑤ 가 한 줄에 배치된 전형적 문화유산 문항
    const cells = [0, 1, 2, 3, 4].map((i) =>
      resolveChoiceBox({ x: 0.02 + i * 0.19, y: 0.75, width: 0.17, height: 0.18 })
    );
    expect(cells.every((c) => c !== null)).toBe(true);
    // 인접 셀이 순서대로 오른쪽으로 이동
    expect(cells[1]!.x).toBeGreaterThan(cells[0]!.x);
    expect(cells[4]!.x).toBeGreaterThan(cells[3]!.x);
  });
});

describe("questionBox 클램프 — 2단 시험지 가로 오염 방지", () => {
  // 제78회 4쪽 같은 2단 페이지: 왼쪽 단 x≈0.02~0.48, 오른쪽 단 x≈0.5~0.98
  const RIGHT_COL = { x: 0.5, y: 0.45, width: 0.48, height: 0.5 };
  const LEFT_COL = { x: 0.02, y: 0.4, width: 0.46, height: 0.55 };

  it("imageBox 없이 앵커만 있으면 가로 폴백이 문항 영역(단) 안으로 제한된다", () => {
    const box = resolveFigureBox({
      scoreMarkerY: 0.55,
      choicesTopY: 0.8,
      questionBox: RIGHT_COL,
    });
    expect(box).not.toBeNull();
    // 종전 폴백(0.04~0.96)이면 왼쪽 단까지 침범 — 이제 오른쪽 단 안
    expect(box!.x).toBeGreaterThanOrEqual(0.5);
    expect(box!.x + box!.width).toBeLessThanOrEqual(0.98);
  });

  it("imageBox가 단을 벗어나면 문항 영역으로 잘라낸다", () => {
    const box = resolveFigureBox({
      imageBox: { x: 0.4, y: 0.5, width: 0.3, height: 0.2 }, // 왼쪽 단까지 걸침
      questionBox: RIGHT_COL,
    });
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0.5); // 침범분 제거
  });

  it("questionBox가 비정상(너무 작음)이면 무시하고 기존 폴백을 쓴다", () => {
    const box = resolveFigureBox({
      scoreMarkerY: 0.3,
      choicesTopY: 0.7,
      questionBox: { x: 0.5, y: 0.5, width: 0.05, height: 0.02 }, // 문항 영역치곤 비정상
    });
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(0.04, 3); // 본문 컬럼 폴백 유지
  });

  it("resolveChoiceBox도 문항 영역으로 클램프된다", () => {
    const box = resolveChoiceBox({ x: 0.45, y: 0.7, width: 0.2, height: 0.15 }, LEFT_COL);
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeCloseTo(0.48, 10); // 정확히 단 경계에서 잘림(부동소수점 허용)
  });

  it("clampBoxWithin: 완전히 벗어난 상자는 null", () => {
    expect(
      clampBoxWithin({ x: 0.6, y: 0.5, width: 0.2, height: 0.2 }, { x: 0, y: 0, width: 0.5, height: 1 })
    ).toBeNull();
  });

  it("clampBoxWithin: container가 없으면 그대로", () => {
    const b = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 };
    expect(clampBoxWithin(b, null)).toEqual(b);
  });
});
