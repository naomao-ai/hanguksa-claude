import { db } from "../src/lib/firebase-admin.ts";

async function main() {
  const snap = await db.collection("facts").where("title", "==", "백지 임명장, 돈으로 사고 팔다").get();
  if (snap.empty) {
    console.log("Not found.");
    return;
  }
  const fact = snap.docs[0].data();
  console.log("ID:", snap.docs[0].id);
  console.log("Body:", fact.body);
  console.log("Detail:", fact.detail);
}

main().catch(console.error);
