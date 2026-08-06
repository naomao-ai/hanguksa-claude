// passage 앞머리에 붙은 대괄호 라벨([해설]·[자료] 등) 분포 전수 조사.
import { db } from "../src/lib/firebase-admin.ts";

const PREFIX_RE = /^\s*\[([^\]]{1,20})\]\s*/;

async function main() {
  const snap = await db.collection("questions").get();
  const qs = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as any[];
  const withPassage = qs.filter((q) => typeof q.passage === "string" && q.passage.trim());

  const label: Record<string, number> = {};
  const samples: Record<string, string> = {};
  let prefixed = 0;
  for (const q of withPassage) {
    const m = q.passage.match(PREFIX_RE);
    if (m) {
      prefixed++;
      const key = m[1].trim();
      label[key] = (label[key] ?? 0) + 1;
      if (!samples[key]) samples[key] = q.passage.slice(0, 70);
    }
  }
  console.log(`passage 보유: ${withPassage.length} / 전체 ${qs.length}`);
  console.log(`앞머리 [라벨] 붙은 것: ${prefixed}\n`);
  console.log("=== 라벨 분포 ===");
  for (const [k, v] of Object.entries(label).sort((a, b) => b[1] - a[1])) {
    console.log(`  [${k}] × ${v}`);
    console.log(`     예: ${samples[k]}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
