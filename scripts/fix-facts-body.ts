import { db } from "../src/lib/firebase-admin.ts";

async function main() {
  console.log("Starting DB migration for facts.body...");
  const snap = await db.collection("facts").get();
  let count = 0;
  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.detail && data.detail.length > 0) {
      const firstPara = data.detail[0];
      // 마침표 뒤 공백 기준으로 문장 분리
      const sentences = firstPara.split(/(?<=\.)\s+/).map((s: string) => s.trim()).filter(Boolean);
      let newBody = "";
      if (sentences.length > 2) {
        newBody = sentences.slice(0, 2).join(" ");
      } else {
        newBody = firstPara;
      }
      
      if (data.body !== newBody) {
        await doc.ref.update({ body: newBody });
        count++;
      }
    }
  }
  console.log(`Updated ${count} facts.`);
}

main().catch(console.error);
