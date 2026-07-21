/**
 * Claude Code 문제지 임포트 CLI (웹 /api/analyze 경로의 크레딧-프리 대체).
 *
 * Claude Code가 시험지 이미지를 vision으로 정독해 만든 analysis.json을 받아,
 * 웹 업로드와 동일한 파이프라인(zod 검증 → snap.ts 잉크 밴드 보정 → 크롭 →
 * createQuestions)으로 문제은행에 등록한다. 크롭 파이프라인은
 * src/components/admin/UploadPanel.tsx 의 브라우저 파이프라인을 정본으로 미러.
 *
 * 모드:
 *   --dump-facts
 *       연표 목록을 "id|era|year|title|keywords" 줄로 출력 (factIds 배정용)
 *   --json <file> --images <dir> --dry-run --out <dir>
 *       검증→보정→크롭 PNG·manifest.json + 재검수 몽타주(montage_N·choices_qNN)
 *       저장만. Firestore 접근 없음. (--no-montage로 몽타주 생략 가능)
 *   --json <file> --images <dir> --update [--release "제목"]
 *       같은 회차·번호의 기존 문항만 제자리 교체(내용·이미지 갱신). 나머지 문항은
 *       보존. 번호가 매칭 안 되는 문항은 건너뛴다(비파괴).
 *   --json <file> --images <dir> --upload [--replace-round] [--release "제목"]
 *       동일 파이프라인 재실행 후 저장. 같은 회차가 이미 있으면
 *       --replace-round(기존 전량 삭제 후 저장) 없이는 중단한다.
 *       저장과 함께 회차 폴더(<json폴더>/crops 또는 --out)에 문제·보기 사진과
 *       재검수 몽타주를 정리 저장한다(업로드 후에도 잘림·이물 재검수 가능).
 *
 * analysis.json 형식: AnalyzeResult + { images: string[] } (imageSourceIndex가
 * 가리키는 파일명 배열, --images 디렉터리 기준). 문항에 factIds?: string[] 확장.
 *
 * 실행: npm run import:exam -- <인자>  (env는 .env.local 자동 주입)
 */
import { z } from "zod";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AnalyzeResultSchema, AnalyzedQuestionSchema } from "../src/lib/ai/schema.ts";
import { ERA_KEYS } from "../src/lib/domain.ts";
import { snapFigureBand, snapChoiceBoxes } from "../src/lib/snap.ts";
import { resolveFigureBox, resolveChoiceBox, type NormalizedBox } from "../src/lib/image.ts";
import { loadInkMapFromFile, cropRegionToDataUrl, dataUrlToBuffer } from "./lib/node-image.ts";
import type { NewQuestion } from "../src/lib/firestore.ts";
import type { AnalyzedQuestion } from "../src/lib/ai/schema.ts";

// ---------- CLI 인자 ----------
const args = process.argv.slice(2);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && !String(args[i + 1] ?? "").startsWith("--") ? args[i + 1] : undefined;
};
const has = (name: string) => args.includes(`--${name}`);

// ---------- 입력 스키마 (원본 스키마 무수정 확장) ----------
const BoxSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});
const ImportQuestionSchema = AnalyzedQuestionSchema.extend({
  /** Claude Code가 --dump-facts 목록을 보고 직접 배정한 연표 id (최대 5) */
  factIds: z.array(z.string()).max(5).optional(),
  /**
   * 발문 삽화 수동 크롭 오버라이드. dry-run 검수에서 자동 보정(snap)이 틀린 문항에
   * 정확한 박스를 직접 지정하는 탈출구 — 지정 시 snap·폴백을 건너뛰고 그대로 자른다.
   * (텍스트 위주 삽화는 본문 줄이 선지로 오인될 수 있음이 실측으로 확인됨)
   */
  figureBox: BoxSchema.nullable().optional(),
  /**
   * 그림 선지 수동 크롭 오버라이드. true면 잉크 스냅(snapChoiceBoxes)을 건너뛰고
   * choiceImages[i].imageBox를 그대로 자른다 — figureBox와 같은 탈출구.
   * 선지들이 서로 가까이 붙어 스냅이 인접 선지 잉크까지 물어버릴 때 사용한다.
   */
  manualChoiceBoxes: z.boolean().optional(),
});
const ImportFileSchema = AnalyzeResultSchema.extend({
  /** imageSourceIndex → 파일명 매핑 (--images 디렉터리 기준) */
  images: z.array(z.string()).min(1),
  questions: z.array(ImportQuestionSchema).min(1),
});
type ImportQuestion = z.infer<typeof ImportQuestionSchema>;

// ---------- 크롭 파이프라인 (UploadPanel.tsx 미러) ----------
interface CropResult {
  imageUrl: string | null;
  figureMethod: "manual" | "snap" | "anchor" | "qbox" | "none";
  choices: (string | { text: string; imageUrl: string | null })[];
  warnings: string[];
}

async function cropQuestion(q: ImportQuestion, imagePaths: string[]): Promise<CropResult> {
  const warnings: string[] = [];
  const src = q.imageSourceIndex != null ? imagePaths[q.imageSourceIndex] : undefined;
  let imageUrl: string | null = null;
  let figureMethod: CropResult["figureMethod"] = "none";

  // 0) 수동 오버라이드: 검수에서 확정한 박스를 그대로 크롭 (snap·폴백 생략)
  if (q.figureBox && src) {
    try {
      imageUrl = await cropRegionToDataUrl(src, q.figureBox);
      figureMethod = "manual";
    } catch (e) {
      warnings.push(`figureBox 수동 크롭 실패: ${e instanceof Error ? e.message : e}`);
    }
  }

  // 1) 발문 삽화: snap 밴드 → 모델 앵커 폴백 → 문항 영역 폴백 (UploadPanel과 동일)
  let figBox: NormalizedBox | null = null;
  if (!imageUrl && q.imageBox && src) {
    try {
      const ink = await loadInkMapFromFile(src);
      figBox = snapFigureBand(ink, q.imageBox, q.questionBox);
    } catch (e) {
      warnings.push(`잉크맵 실패: ${e instanceof Error ? e.message : e}`);
    }
  }
  const box = figBox ?? resolveFigureBox(q);
  if (!imageUrl && box && src) {
    try {
      imageUrl = await cropRegionToDataUrl(src, box);
      figureMethod = figBox ? "snap" : "anchor";
    } catch (e) {
      warnings.push(`발문 크롭 실패: ${e instanceof Error ? e.message : e}`);
    }
  }
  if (!imageUrl && q.imageDescription && q.questionBox && src) {
    const qbox = resolveChoiceBox(q.questionBox);
    if (qbox) {
      try {
        imageUrl = await cropRegionToDataUrl(src, qbox);
        figureMethod = "qbox";
        warnings.push("발문 삽화를 문항 영역 전체 크롭으로 폴백");
      } catch {
        warnings.push("문항 영역 폴백 크롭도 실패 — 그림 묘사 텍스트만 저장됨");
      }
    }
  }

  // 2) 그림 선지 (UploadPanel의 snappedAt 클램프 생략 로직 포함)
  let choices: CropResult["choices"] = q.choices.map((c) =>
    typeof c === "string" ? c : { text: c.text ?? "", imageUrl: c.imageUrl ?? null }
  );
  if (q.choiceKind === "image" && Array.isArray(q.choiceImages) && q.choiceImages.length) {
    const snapIdx =
      q.choiceImages.find((c) => c?.imageSourceIndex != null)?.imageSourceIndex ??
      q.imageSourceIndex ?? 0;
    const snapSrc = imagePaths[snapIdx];
    const boxes: (NormalizedBox | null)[] = q.choiceImages.map((cf) => cf?.imageBox ?? null);
    const snappedAt = new Set<number>();
    if (snapSrc && !q.manualChoiceBoxes) {
      try {
        const ink = await loadInkMapFromFile(snapSrc);
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
        warnings.push("그림 선지 스냅 실패 — 모델 원좌표 사용");
      }
    }
    choices = await Promise.all(
      q.choiceImages.map(async (cf, i) => {
        const label = typeof q.choices[i] === "string" ? (q.choices[i] as string) : "";
        const csrc =
          cf?.imageSourceIndex != null ? imagePaths[cf.imageSourceIndex] : src ?? imagePaths[0];
        // 수동 모드는 figureBox와 동일 의미 — 안전 패딩·클램프 없이 준 좌표 그대로 자른다
        const cbox = q.manualChoiceBoxes
          ? boxes[i]
          : resolveChoiceBox(boxes[i], snappedAt.has(i) ? undefined : q.questionBox);
        if (cbox && csrc) {
          try {
            return { text: label, imageUrl: await cropRegionToDataUrl(csrc, cbox) };
          } catch {
            warnings.push(`선지 ${i + 1} 크롭 실패`);
            return { text: label, imageUrl: null };
          }
        }
        warnings.push(`선지 ${i + 1} 좌표 없음`);
        return { text: label, imageUrl: null };
      })
    );
  }

  return { imageUrl, figureMethod, choices, warnings };
}

// ---------- 크롭 영구 저장 (dry-run·upload·update 공통) ----------
/**
 * 발문 삽화·그림 선지 크롭 PNG를 회차 폴더에 정리 저장하고 manifest를 기록한다.
 * 파일명 규약: q<번호>_figure.png / q<번호>_choice_<n>.png. dry-run·실제 업로드 모두
 * 동일 산출물을 남겨, 업로드 후에도 회차 폴더에서 이미지를 재검수할 수 있게 한다.
 */
async function persistCrops(
  outDir: string,
  questions: ImportQuestion[],
  crops: CropResult[]
): Promise<Record<string, unknown>[]> {
  await mkdir(outDir, { recursive: true });
  const manifest: Record<string, unknown>[] = [];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const c = crops[i];
    const nn = String(q.number ?? i + 1).padStart(2, "0");
    const files: string[] = [];
    if (c.imageUrl) {
      const f = `q${nn}_figure.png`;
      await writeFile(path.join(outDir, f), dataUrlToBuffer(c.imageUrl));
      files.push(f);
    }
    for (let k = 0; k < c.choices.length; k++) {
      const ch = c.choices[k];
      if (typeof ch !== "string" && ch.imageUrl) {
        const f = `q${nn}_choice_${k + 1}.png`;
        await writeFile(path.join(outDir, f), dataUrlToBuffer(ch.imageUrl));
        files.push(f);
      }
    }
    manifest.push({
      number: q.number,
      figureMethod: c.figureMethod,
      answerIndex: q.answerIndex,
      answerSource: q.answerSource ?? null,
      era: q.era,
      choiceKind: q.choiceKind ?? "text",
      factIds: q.factIds ?? [],
      warnings: c.warnings,
      files,
    });
  }
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  return manifest;
}

/**
 * 재검수용 몽타주 시트 생성. 발문 삽화는 10문항씩 세로로 쌓은 montage_N.png,
 * 그림 선지는 문항별 5지를 가로로 늘어놓은 choices_qNN.png. Claude Code가 이 시트를
 * Read(vision)로 훑어 "사진외 형상 포함"·"사진 잘림"을 한눈에 판정하도록 한다.
 */
async function buildMontages(
  outDir: string,
  questions: ImportQuestion[],
  crops: CropResult[]
): Promise<string[]> {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const written: string[] = [];

  // 1) 발문 삽화 시트 (10문항/장)
  const figs: { n: number; buf: Buffer }[] = [];
  for (let i = 0; i < questions.length; i++) {
    if (crops[i].imageUrl) {
      figs.push({ n: questions[i].number ?? i + 1, buf: dataUrlToBuffer(crops[i].imageUrl!) });
    }
  }
  const W = 560, PAD = 8, LABEL = 26, PERPAGE = 10, MAXH = 260;
  for (let p = 0, idx = 0; idx < figs.length; p++, idx += PERPAGE) {
    const batch = figs.slice(idx, idx + PERPAGE);
    const items: { n: number; img: any; w: number; h: number }[] = [];
    for (const b of batch) {
      const img = await loadImage(b.buf);
      const scale = Math.min((W - 2 * PAD) / img.width, MAXH / img.height);
      items.push({ n: b.n, img, w: img.width * scale, h: img.height * scale });
    }
    const totalH = items.reduce((s, it) => s + it.h + LABEL + PAD, PAD);
    const canvas = createCanvas(W, totalH);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f0eee9"; ctx.fillRect(0, 0, W, totalH);
    let y = PAD;
    for (const it of items) {
      ctx.fillStyle = "#b02020"; ctx.font = "bold 18px sans-serif";
      ctx.fillText(`#${it.n}`, PAD, y + 19);
      y += LABEL;
      ctx.fillStyle = "#ffffff"; ctx.fillRect(PAD, y, it.w, it.h);
      ctx.drawImage(it.img, PAD, y, it.w, it.h);
      ctx.strokeStyle = "#ccc"; ctx.strokeRect(PAD, y, it.w, it.h);
      y += it.h + PAD;
    }
    const out = path.join(outDir, `montage_${p + 1}.png`);
    await writeFile(out, canvas.toBuffer("image/png"));
    written.push(out);
  }

  // 2) 그림 선지 행 (문항별)
  const circ = ["①", "②", "③", "④", "⑤"];
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (q.choiceKind !== "image") continue;
    const imgs: any[] = [];
    for (const ch of crops[i].choices) {
      if (typeof ch !== "string" && ch.imageUrl) imgs.push(await loadImage(dataUrlToBuffer(ch.imageUrl)));
      else imgs.push(null);
    }
    if (!imgs.some(Boolean)) continue;
    const CW = 160, CH = 150, TOP = 24;
    const canvas = createCanvas(CW * imgs.length, CH + TOP);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#eeeeee"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    imgs.forEach((im, k) => {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(k * CW, TOP, CW, CH);
      if (im) {
        const s = Math.min(CW / im.width, CH / im.height);
        const w = im.width * s, h = im.height * s;
        ctx.drawImage(im, k * CW + (CW - w) / 2, TOP + (CH - h) / 2, w, h);
      }
      ctx.fillStyle = "#b00000"; ctx.font = "bold 15px sans-serif";
      ctx.fillText(circ[k] ?? `${k + 1}`, k * CW + 4, 17);
    });
    const nn = String(q.number ?? i + 1).padStart(2, "0");
    const out = path.join(outDir, `choices_q${nn}.png`);
    await writeFile(out, canvas.toBuffer("image/png"));
    written.push(out);
  }
  return written;
}

// ---------- 메인 ----------
async function main() {
  // 연표 목록 출력 (factIds 배정용)
  if (has("dump-facts")) {
    const { getFacts } = await import("../src/lib/firestore.ts");
    const facts = await getFacts();
    for (const f of facts) {
      console.log(`${f.id}|${f.era}|${f.year ?? ""}|${f.title}|${(f.keywords ?? []).join(",")}`);
    }
    console.error(`# 총 ${facts.length}개`);
    return;
  }

  const jsonPath = opt("json");
  const imagesDir = opt("images");
  if (!jsonPath || !imagesDir) {
    console.error(
      "사용법:\n" +
        "  --dump-facts\n" +
        '  --json <file> --images <dir> --dry-run --out <dir>\n' +
        '  --json <file> --images <dir> --update [--release "제목"]   (같은 회차·번호 제자리 교체)\n' +
        '  --json <file> --images <dir> --upload [--replace-round] [--release "제목"]'
    );
    process.exit(1);
  }

  // 검증
  const raw = JSON.parse(await readFile(jsonPath, "utf8"));
  const parsed = ImportFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("❌ analysis.json 형식 오류:");
    for (const iss of parsed.error.issues.slice(0, 20)) {
      console.error(`  ${iss.path.join(".")}: ${iss.message}`);
    }
    process.exit(1);
  }
  const { level, examRound, examYear, questions, images } = parsed.data;
  const imagePaths = images.map((f) => path.resolve(imagesDir, f));
  for (const p of imagePaths) {
    await readFile(p).catch(() => {
      console.error(`❌ 이미지 없음: ${p}`);
      process.exit(1);
    });
  }
  console.log(`문항 ${questions.length}개 · 이미지 ${images.length}장 · 회차 ${examRound ?? "?"} · 등급 ${level ?? "?"}`);

  // 크롭 파이프라인 (dry-run과 upload가 동일 코드 — 결정적이므로 미리보기=최종)
  const crops: CropResult[] = [];
  for (const q of questions) {
    crops.push(await cropQuestion(q, imagePaths));
  }

  // ---------- dry-run ----------
  if (has("dry-run")) {
    const outDir = opt("out") ?? path.join(path.dirname(jsonPath), "crops");
    const manifest = await persistCrops(outDir, questions, crops);
    const warned = manifest.filter((m) => (m.warnings as string[]).length);
    console.log(`✅ dry-run 완료 → ${outDir}`);
    console.log(`   크롭 파일 ${manifest.reduce((s, m) => s + (m.files as string[]).length, 0)}개, 경고 문항 ${warned.length}개`);
    if (has("montage") || !has("no-montage")) {
      const sheets = await buildMontages(outDir, questions, crops);
      console.log(`   재검수 몽타주 ${sheets.length}장 생성 (montage_N.png · choices_qNN.png) — Read로 사진외 형상·잘림 검수`);
    }
    return;
  }

  // ---------- update (제자리 교체: 같은 회차·번호 문항만 덮어씀, 나머지 보존) ----------
  if (has("update")) {
    if (examRound == null) {
      console.error("❌ --update는 examRound가 필요합니다(번호로 기존 문항을 찾음).");
      process.exit(1);
    }
    const { getQuestions, updateQuestion, getFacts, createRelease } = await import(
      "../src/lib/firestore.ts"
    );
    const defLevel = level === "GIBON" ? "GIBON" : "SIMHWA";
    const validIds = new Set((await getFacts()).map((f) => f.id));
    for (const q of questions) {
      if (!q.factIds?.length) continue;
      const bad = q.factIds.filter((id) => !validIds.has(id));
      if (bad.length) {
        console.warn(`⚠ #${q.number}: 미존재 factId 제거 — ${bad.join(", ")}`);
        q.factIds = q.factIds.filter((id) => validIds.has(id));
      }
    }
    const existing = await getQuestions({ round: examRound, level: defLevel, limit: 500 });
    const byNum = new Map<number, string>();
    for (const ex of existing) if (ex.number != null) byNum.set(ex.number, ex.id);

    let updated = 0;
    const missing: number[] = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const id = q.number != null ? byNum.get(q.number) : undefined;
      if (!id) { missing.push(q.number ?? -1); continue; }
      const item: NewQuestion = {
        level: defLevel,
        examRound,
        examYear: examYear ?? null,
        number: q.number ?? null,
        stem: q.stem,
        passage: q.passage ?? null,
        imageDescription: q.imageDescription ?? null,
        imageUrl: crops[i].imageUrl,
        answerIndex: q.answerIndex,
        explanation: q.explanation ?? null,
        era: ERA_KEYS.includes(q.era) ? q.era : "joseon",
        topics: q.topics ?? [],
        qType: q.qType || "기타",
        difficulty: q.difficulty ?? null,
        choices: crops[i].choices,
        factIds: q.factIds ?? [],
      };
      const res = await updateQuestion(id, item);
      if (res) { updated++; console.log(`  ✎ #${q.number} 교체 (${id})`); }
      else missing.push(q.number ?? -1);
    }
    console.log(
      `✅ ${updated}문항 제자리 교체 완료` +
        (missing.length ? ` · 매칭 실패 ${missing.length}개: ${missing.join(",")}` : "")
    );
    // 회차 폴더에 문제·보기 사진 정리 저장 (업로드 후 재검수용)
    const upOut = opt("out") ?? path.join(path.dirname(jsonPath), "crops");
    await persistCrops(upOut, questions, crops);
    if (!has("no-montage")) await buildMontages(upOut, questions, crops);
    console.log(`   문제·보기 사진 정리 저장 → ${upOut}`);
    const relTitle = opt("release");
    if (relTitle) {
      const rel = await createRelease({
        title: relTitle,
        notes: `Claude Code 임포트 교체 — ${examRound}회 ${defLevel} ${updated}문항 이미지·내용 갱신`,
        examRound,
        examLevel: defLevel,
        addedCount: 0,
      });
      console.log(`✅ 릴리스 v${rel.version} 발행: ${rel.title}`);
    }
    return;
  }

  // ---------- upload ----------
  if (!has("upload")) {
    console.error("모드를 지정하세요: --dry-run · --update · --upload");
    process.exit(1);
  }
  const { createQuestions, getQuestions, deleteQuestion, createRelease, getFacts } = await import(
    "../src/lib/firestore.ts"
  );

  // factIds 화이트리스트 검증 (실존 id만, 최대 5 — sanitizeFactIds 방식)
  const validIds = new Set((await getFacts()).map((f) => f.id));
  for (const q of questions) {
    if (!q.factIds?.length) continue;
    const bad = q.factIds.filter((id) => !validIds.has(id));
    if (bad.length) {
      console.warn(`⚠ #${q.number}: 미존재 factId 제거 — ${bad.join(", ")}`);
      q.factIds = q.factIds.filter((id) => validIds.has(id));
    }
  }

  // 회차 중복 가드
  const defLevel = level === "GIBON" ? "GIBON" : "SIMHWA";
  if (examRound != null) {
    const existing = await getQuestions({ round: examRound, level: defLevel, limit: 500 });
    if (existing.length) {
      if (!has("replace-round")) {
        console.error(
          `❌ ${examRound}회 ${defLevel} 문항이 이미 ${existing.length}개 있습니다.\n` +
            "   기존을 지우고 다시 넣으려면 --replace-round, 그래도 추가하려면 회차를 확인하세요. 중단합니다."
        );
        process.exit(1);
      }
      console.log(`--replace-round: 기존 ${existing.length}개 삭제 중…`);
      for (const ex of existing) await deleteQuestion(ex.id);
      console.log("   삭제 완료");
    }
  }

  // NewQuestion 매핑 (bulk/route.ts 미러 + factIds)
  const items: NewQuestion[] = questions.map((q, i) => ({
    level: defLevel,
    examRound: examRound ?? null,
    examYear: examYear ?? null,
    number: q.number ?? null,
    stem: q.stem,
    passage: q.passage ?? null,
    imageDescription: q.imageDescription ?? null,
    imageUrl: crops[i].imageUrl,
    answerIndex: q.answerIndex,
    explanation: q.explanation ?? null,
    era: ERA_KEYS.includes(q.era) ? q.era : "joseon",
    topics: q.topics ?? [],
    qType: q.qType || "기타",
    difficulty: q.difficulty ?? null,
    choices: crops[i].choices,
    source: "UPLOAD",
    factIds: q.factIds ?? [],
  }));

  const created = await createQuestions(items);
  console.log(`✅ ${created}문항 저장 완료`);

  // 회차 폴더에 문제·보기 사진 정리 저장 (업로드 후에도 재검수 가능)
  const upOut = opt("out") ?? path.join(path.dirname(jsonPath), "crops");
  await persistCrops(upOut, questions, crops);
  if (!has("no-montage")) await buildMontages(upOut, questions, crops);
  console.log(`   문제·보기 사진 정리 저장 → ${upOut} (montage_N.png·choices_qNN.png 포함)`);

  const releaseTitle = opt("release");
  if (releaseTitle) {
    const rel = await createRelease({
      title: releaseTitle,
      notes: `Claude Code 임포트 — ${examRound ?? "?"}회 ${defLevel} ${created}문항`,
      examRound: examRound ?? null,
      examLevel: defLevel,
      addedCount: created,
    });
    console.log(`✅ 릴리스 v${rel.version} 발행: ${rel.title}`);
  } else {
    console.log("ℹ 릴리스 미발행 — 관리자 UI '업데이트 발행' 또는 --release \"제목\" 사용");
  }
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
