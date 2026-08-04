import { db } from "../src/lib/firebase-admin.ts";

async function main() {
  const snap = await db.collection("facts").get();
  const facts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

  console.log("Facts containing '귀주':");
  for (const f of facts) {
    if (f.title && f.title.includes("귀주")) {
      console.log(`- Fact: id=${f.id}, title="${f.title}", era="${f.era}"`);
    }
  }

  const qsSnap = await db.collection("questions").get();
  const qs = qsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
  console.log("\nQuestions containing '귀주' in stem:");
  for (const q of qs) {
    if (q.stem && q.stem.includes("귀주")) {
      console.log(`- Question: id=${q.id}, stem="${q.stem.substring(0, 20)}..."`);
    }
  }
}

main().catch(console.error);
