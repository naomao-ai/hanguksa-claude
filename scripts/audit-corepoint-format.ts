// corePoint 실제 저장 형태 분포 + 이슈1(자료제시형 자료 누락) 샘플 상세.
import { db } from "../src/lib/firebase-admin.ts";

async function main() {
  const snap = await db.collection("questions").get();
  const qs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];

  let str = 0, objFull = 0, objPartial = 0, none = 0, other = 0;
  const strSamples: string[] = [];
  const partialSamples: string[] = [];
  for (const q of qs) {
    const c = q.corePoint;
    if (c == null || c === "") { none++; continue; }
    if (typeof c === "string") { str++; if (strSamples.length < 3) strSamples.push(c.slice(0, 80)); continue; }
    if (typeof c === "object") {
      const hasSummary = typeof c.summary === "string" && c.summary.trim();
      const hasKw = Array.isArray(c.keywords);
      if (hasSummary && hasKw) objFull++;
      else { objPartial++; if (partialSamples.length < 3) partialSamples.push(JSON.stringify(c).slice(0, 120)); }
      continue;
    }
    other++;
  }
  console.log("=== corePoint 저장 형태 분포 ===");
  console.log(`  문자열(마크다운): ${str}`);
  console.log(`  객체(summary+keywords 완전): ${objFull}`);
  console.log(`  객체(부분/불완전): ${objPartial}`);
  console.log(`  없음: ${none}`);
  console.log(`  기타: ${other}`);
  if (strSamples.length) { console.log("  [문자열 샘플]"); strSamples.forEach((s) => console.log("    ·", s)); }
  if (partialSamples.length) { console.log("  [부분객체 샘플]"); partialSamples.forEach((s) => console.log("    ·", s)); }

  console.log("\n=== [이슈1] 자료제시형인데 자료 없음 — 상세 ===");
  const targets = qs.filter((q) => q.qType === "자료제시형" && !q.passage?.trim() && !q.imageUrl?.trim());
  for (const q of targets) {
    const choicesHaveImg = (q.choices ?? []).some((c: any) => c?.imageUrl);
    console.log(`\n· ${q.examRound}회 ${q.level} ${q.number}번 (${q.id})`);
    console.log(`  발문: ${q.stem}`);
    console.log(`  그림선지 보유: ${choicesHaveImg ? "예(선지가 이미지)" : "아니오(순수 텍스트 선지)"}`);
    console.log(`  선지: ${(q.choices ?? []).map((c: any) => c.text || "[이미지]").join(" / ")}`);
    console.log(`  imageDescription: ${q.imageDescription || "(없음)"}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
