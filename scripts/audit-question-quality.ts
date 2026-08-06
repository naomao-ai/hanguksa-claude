// 문제 품질 전수검사 — 사용자 보고 3대 이슈를 데이터 관점에서 진단한다.
//   1) 그림 없이 글만: imageDescription(삽화 의도)이 있는데 imageUrl이 없는 문항,
//      그리고 자료제시형인데 passage·imageUrl이 모두 없는 문항.
//   2) 그림+설명 동시 노출: imageUrl과 (passage|imageDescription)이 함께 있는 문항 수
//      (UI가 클릭 토글로 처리하는지 별도 확인용 카운트).
//   3) 해설 결손: explanation이 비었고 corePoint도 없는 문항.
// 사용법: node --env-file=.env.local --experimental-strip-types scripts/audit-question-quality.ts
import { db } from "../src/lib/firebase-admin.ts";

type Choice = { text?: string; imageUrl?: string | null };
type Q = {
  id: string;
  number?: number | null;
  examRound?: number | null;
  level?: string;
  qType?: string;
  era?: string;
  stem?: string;
  passage?: string | null;
  imageUrl?: string | null;
  imageDescription?: string | null;
  explanation?: string | null;
  corePoint?: unknown;
  choices?: Choice[];
};

const tag = (q: Q) => `${q.examRound ?? "?"}회 ${q.level ?? "?"} ${q.number ?? "?"}번(${q.id})`;
const isBlank = (s?: string | null) => !s || !String(s).trim();

async function main() {
  const snap = await db.collection("questions").get();
  const qs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Q[];
  console.log(`총 문항: ${qs.length}\n`);

  // ---- 이슈 1: 그림 결손 ----
  const figMissing = qs.filter((q) => !isBlank(q.imageDescription) && isBlank(q.imageUrl));
  const jaryoNoSource = qs.filter(
    (q) => q.qType === "자료제시형" && isBlank(q.passage) && isBlank(q.imageUrl)
  );
  // 그림선지인데 일부 선지 이미지 결손
  const choiceImgMissing = qs.filter((q) => {
    const cs = q.choices ?? [];
    const hasImg = cs.some((c) => c && c.imageUrl);
    return hasImg && cs.some((c) => !c || !c.imageUrl);
  });

  // ---- 이슈 2: 그림+텍스트 동시 보유 ----
  const imgWithText = qs.filter(
    (q) => !isBlank(q.imageUrl) && (!isBlank(q.passage) || !isBlank(q.imageDescription))
  );
  const imgWithPassage = qs.filter((q) => !isBlank(q.imageUrl) && !isBlank(q.passage));

  // ---- 이슈 3: 해설 결손 ----
  const hasCore = (q: Q) => {
    const c: any = q.corePoint;
    return c && (isBlank(c.summary) === false || (Array.isArray(c.keywords) && c.keywords.length));
  };
  const noExpl = qs.filter((q) => isBlank(q.explanation));
  const noExplNoCore = qs.filter((q) => isBlank(q.explanation) && !hasCore(q));

  const byType: Record<string, number> = {};
  for (const q of qs) byType[q.qType ?? "?"] = (byType[q.qType ?? "?"] ?? 0) + 1;

  console.log("=== 유형 분포 ===");
  for (const [k, v] of Object.entries(byType).sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);

  console.log("\n=== [이슈1] 그림 결손 ===");
  console.log(`imageDescription 있음 + imageUrl 없음: ${figMissing.length}`);
  figMissing.slice(0, 40).forEach((q) => console.log(`   - ${tag(q)}`));
  if (figMissing.length > 40) console.log(`   ...외 ${figMissing.length - 40}`);
  console.log(`자료제시형인데 passage·imageUrl 모두 없음: ${jaryoNoSource.length}`);
  jaryoNoSource.slice(0, 40).forEach((q) => console.log(`   - ${tag(q)} | ${(q.stem ?? "").slice(0, 40)}`));
  if (jaryoNoSource.length > 40) console.log(`   ...외 ${jaryoNoSource.length - 40}`);
  console.log(`그림선지 일부 이미지 결손: ${choiceImgMissing.length}`);
  choiceImgMissing.slice(0, 20).forEach((q) => console.log(`   - ${tag(q)}`));

  console.log("\n=== [이슈2] 그림+텍스트 동시 보유(클릭 토글 대상) ===");
  console.log(`imageUrl + (passage|imageDescription): ${imgWithText.length}`);
  console.log(`  그중 imageUrl + passage 동시: ${imgWithPassage.length}`);

  console.log("\n=== [이슈3] 해설 결손 ===");
  console.log(`explanation 빈 문항: ${noExpl.length}`);
  console.log(`explanation·corePoint 둘 다 없음(완전 결손): ${noExplNoCore.length}`);
  noExplNoCore.slice(0, 40).forEach((q) => console.log(`   - ${tag(q)} | ${(q.stem ?? "").slice(0, 40)}`));
  if (noExplNoCore.length > 40) console.log(`   ...외 ${noExplNoCore.length - 40}`);

  // 회차별 해설 결손 요약
  const roundMiss: Record<string, { total: number; miss: number }> = {};
  for (const q of qs) {
    const key = `${q.examRound ?? "?"}-${q.level ?? "?"}`;
    roundMiss[key] ??= { total: 0, miss: 0 };
    roundMiss[key].total++;
    if (isBlank(q.explanation)) roundMiss[key].miss++;
  }
  console.log("\n=== 회차·레벨별 해설 결손 ===");
  for (const [k, v] of Object.entries(roundMiss).sort())
    if (v.miss) console.log(`  ${k}: ${v.miss}/${v.total} 결손`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
