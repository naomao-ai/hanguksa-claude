"use client";

/** 정규화 경계상자 (0~1, 좌상단 원점) */
export interface NormalizedBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 배점 마커/보기① 앵커로 그림의 세로 범위를 잡기 위한 입력 */
export interface FigureAnchors {
  imageBox?: NormalizedBox | null;
  /** 배점([n점]) 표시 줄 바로 아래의 세로 위치 (0~1) — 그림 시작 */
  scoreMarkerY?: number | null;
  /** 보기 ①(숫자 1번) 바로 위의 세로 위치 (0~1) — 그림 끝 */
  choicesTopY?: number | null;
  /** 문항 전체 영역 — 모든 크롭을 이 안으로 클램프 (2단 레이아웃 가로 오염 방지) */
  questionBox?: NormalizedBox | null;
}

/** 배점 아래·보기 위로부터의 세로 여유 (이미지 높이 비율) — 텍스트 제외용 안쪽 마진 */
const VERTICAL_MARGIN = 0.008;
/** 외곽 잘림 방지 안전 여백 (±2%). AI bbox가 타이트해 테두리가 잘리는 것을 보정 */
const SAFE_PADDING = 0.02;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * AI가 준 문항 영역이 신뢰할 만한지 검증한다.
 * 문항 영역치고 지나치게 작은 상자는 좌표 오류로 보고 무시(null)한다.
 */
function validQuestionBox(b?: NormalizedBox | null): NormalizedBox | null {
  if (!b) return null;
  if (b.width < 0.1 || b.height < 0.05) return null;
  return b;
}

/** box를 container 영역과 교차(클램프)한다. container가 없으면 그대로 반환 */
export function clampBoxWithin(
  box: NormalizedBox,
  container?: NormalizedBox | null
): NormalizedBox | null {
  if (!container) return box;
  const x1 = Math.max(clamp01(box.x), clamp01(container.x));
  const y1 = Math.max(clamp01(box.y), clamp01(container.y));
  const x2 = Math.min(clamp01(box.x + box.width), clamp01(container.x + container.width));
  const y2 = Math.min(clamp01(box.y + box.height), clamp01(container.y + container.height));
  const width = x2 - x1;
  const height = y2 - y1;
  if (width < 0.02 || height < 0.02) return null;
  return { x: x1, y: y1, width, height };
}

/**
 * 그림의 크롭 박스를 결정한다.
 * 세로는 한능검 배치(발문+배점 → 그림 → 보기)에 따라
 * scoreMarkerY(배점 바로 아래)~choicesTopY(보기 ① 바로 위) 사이로 정량 계산하고,
 * 가로는 AI의 imageBox(x/width)에 ±2% 안전 패딩을 적용한다.
 * 앵커가 없으면 imageBox 전체에 상하좌우 ±2% 패딩을 적용해 폴백한다.
 * questionBox(문항 전체 영역)가 있으면 가로 폴백을 그 단(컬럼) 범위로 잡고,
 * 최종 크롭을 그 안으로 클램프해 2단 시험지에서 옆 단 침범을 막는다.
 */
export function resolveFigureBox(q: FigureAnchors): NormalizedBox | null {
  const hasAnchors =
    q.scoreMarkerY != null &&
    q.choicesTopY != null &&
    q.choicesTopY - q.scoreMarkerY > 2 * VERTICAL_MARGIN;

  if (!q.imageBox && !hasAnchors) return null;

  const qBox = validQuestionBox(q.questionBox);

  // 가로: imageBox ± 안전 패딩(외곽 잘림 방지). 없으면 문항 영역(단) → 본문 컬럼 순으로 추정
  const fbLeft = qBox ? clamp01(qBox.x + 0.01) : 0.04;
  const fbRight = qBox ? clamp01(qBox.x + qBox.width - 0.01) : 0.96;
  const xLeft = q.imageBox ? clamp01(q.imageBox.x - SAFE_PADDING) : fbLeft;
  const xRight = q.imageBox ? clamp01(q.imageBox.x + q.imageBox.width + SAFE_PADDING) : fbRight;
  const x = xLeft;
  const width = xRight - xLeft;

  // 세로: 앵커가 있으면 배점 아래~보기 위(텍스트 제외), 없으면 imageBox에 상하 안전 패딩
  let y: number;
  let height: number;
  if (hasAnchors) {
    y = Math.max(0, (q.scoreMarkerY as number) + VERTICAL_MARGIN);
    const bottom = Math.min(1, (q.choicesTopY as number) - VERTICAL_MARGIN);
    height = bottom - y;
  } else {
    y = clamp01(q.imageBox!.y - SAFE_PADDING);
    const bottom = clamp01(q.imageBox!.y + q.imageBox!.height + SAFE_PADDING);
    height = bottom - y;
  }

  if (width < 0.02 || height < 0.02) return null;
  // 문항 영역 안으로 최종 클램프 (2단 가로 오염 방지)
  return clampBoxWithin({ x, y, width, height }, qBox);
}

/**
 * 그림 선지 하나의 크롭 박스를 결정한다.
 * AI가 준 선지 imageBox에 상하좌우 ±2% 안전 패딩(외곽 잘림 방지)을 적용하고,
 * 너무 작은(잘못된) 상자는 null로 떨어뜨린다. 세로 앵커는 쓰지 않는다.
 * questionBox가 있으면 그 문항 영역 안으로 클램프한다.
 */
export function resolveChoiceBox(
  box: NormalizedBox | null | undefined,
  questionBox?: NormalizedBox | null
): NormalizedBox | null {
  if (!box) return null;
  return resolveFigureBox({ imageBox: box, questionBox });
}

/** Claude로 보낼 이미지 (다운스케일 후) */
export interface ApiImage {
  media_type: string;
  data: string;
}

/**
 * 분석용 이미지를 긴 변 maxEdge 픽셀 이하로 다운스케일해 JPEG base64로 반환한다.
 * 크롭 소스는 고해상도 원본(preview)을 그대로 쓰고, Claude에는 작은 사본을 보내
 * 인식 품질은 유지하면서 입력 토큰·전송량을 줄인다.
 */
export function downscaleForApi(
  dataUrl: string,
  maxEdge = 1600,
  quality = 0.85
): Promise<ApiImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = Math.min(1, maxEdge / longest);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas 컨텍스트를 만들 수 없습니다."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const out = canvas.toDataURL("image/jpeg", quality);
        resolve({ media_type: "image/jpeg", data: out.split(",")[1] });
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = dataUrl;
  });
}

/** data URL 이미지의 원본 픽셀 크기 */
export function getImageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = dataUrl;
  });
}

/**
 * 2단 시험지를 좌/우 반으로 분할한다 (약간 겹침).
 * 문항당 유효 해상도를 2배로 높이고 2단 좌표 혼선을 없앤다.
 */
export async function splitColumns(
  dataUrl: string,
  overlap = 0.01
): Promise<{ left: string; right: string }> {
  const [left, right] = await Promise.all([
    cropImageRegion(dataUrl, { x: 0, y: 0, width: 0.5 + overlap, height: 1 }),
    cropImageRegion(dataUrl, { x: 0.5 - overlap, y: 0, width: 0.5 + overlap, height: 1 }),
  ]);
  return { left, right };
}

/**
 * data URL 이미지를 다운스케일해 이진 잉크 맵으로 변환한다 (스냅 보정용).
 * targetWidth 픽셀 폭 기준으로 줄여 계산량을 억제한다.
 */
export async function loadInkMap(
  dataUrl: string,
  targetWidth = 700
): Promise<import("./snap").InkMap> {
  const { buildInkMap } = await import("./snap");
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, targetWidth / img.naturalWidth);
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas 컨텍스트를 만들 수 없습니다."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const px = ctx.getImageData(0, 0, w, h);
        resolve(buildInkMap(px.data, w, h));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = dataUrl;
  });
}

/**
 * data URL 이미지에서 정규화 경계상자 영역을 잘라 PNG data URL로 반환한다.
 * AI가 돌려준 그림 좌표(imageBox)로 원본 업로드 이미지에서 그림만 추출하는 데 사용.
 */
export function cropImageRegion(dataUrl: string, box: NormalizedBox): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        // 좌표를 [0,1]로 보정한 뒤 픽셀로 환산
        const clamp = (v: number) => Math.max(0, Math.min(1, v));
        const x = clamp(box.x) * img.naturalWidth;
        const y = clamp(box.y) * img.naturalHeight;
        const w = clamp(box.width) * img.naturalWidth;
        const h = clamp(box.height) * img.naturalHeight;
        if (w < 4 || h < 4) {
          reject(new Error("crop 영역이 너무 작습니다."));
          return;
        }
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas 컨텍스트를 만들 수 없습니다."));
          return;
        }
        ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = dataUrl;
  });
}
