import { db } from "../src/lib/firebase-admin.ts";

async function main() {
  console.log("Fetching facts...");
  const snapshot = await db.collection("facts").get();
  const facts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

  const titleMap = new Map<string, any[]>();
  for (const fact of facts) {
    const key = `${fact.era}:${fact.title}`;
    if (!titleMap.has(key)) titleMap.set(key, []);
    titleMap.get(key)!.push(fact);
  }

  const duplicates = Array.from(titleMap.entries()).filter(([k, v]) => v.length > 1);
  
  console.log(`Total facts: ${facts.length}`);
  console.log(`Duplicate titles found: ${duplicates.length}`);
  
  for (const [key, list] of duplicates) {
    console.log(`\n-- Duplicate: ${key} (${list.length} instances)`);
    for (const item of list) {
      console.log(`  - id: ${item.id}, body length: ${item.body?.length}, keywords: ${item.keywords?.length}`);
    }
  }
}

main().catch(console.error);
