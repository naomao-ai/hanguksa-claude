import { db } from "../src/lib/firebase-admin.ts";

async function main() {
  console.log("Fetching facts to delete nodes containing '[학습 맥락] 문항'...");
  const snap = await db.collection("facts").get();
  const facts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

  let deletedCount = 0;
  for (const f of facts) {
    if (f.title && f.title.includes("[학습 맥락] 문항")) {
      console.log(`Deleting: id=${f.id}, title="${f.title}"`);
      await db.collection("facts").doc(f.id).delete();
      deletedCount++;
    }
  }

  console.log(`Deletion complete. Deleted ${deletedCount} nodes.`);
}

main().catch(console.error);
