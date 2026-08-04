import { db } from "../src/lib/firebase-admin.ts";

async function main() {
  console.log("Fetching facts...");
  const snap = await db.collection("facts").get();
  const facts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];

  const titleMap = new Map<string, any[]>();
  for (const fact of facts) {
    if (!fact.title) continue;
    // Group by trimmed title only to find any variations
    const trimmedTitle = fact.title.trim().replace(/\s+/g, '');
    const key = trimmedTitle;
    if (!titleMap.has(key)) titleMap.set(key, []);
    titleMap.get(key)!.push(fact);
  }

  const duplicates = Array.from(titleMap.entries()).filter(([k, v]) => v.length > 1);
  
  console.log(`Total facts: ${facts.length}`);
  console.log(`Duplicate groups found: ${duplicates.length}`);
  
  let deletedCount = 0;
  
  for (const [key, list] of duplicates) {
    // Sort to keep the one with most details/body
    list.sort((a, b) => {
      const aScore = (a.body?.length || 0) + (a.detail?.length || 0) * 10;
      const bScore = (b.body?.length || 0) + (b.detail?.length || 0) * 10;
      return bScore - aScore;
    });

    const [keep, ...toDelete] = list;
    
    console.log(`Keeping: ${keep.title} (${keep.id}) - Body length: ${keep.body?.length || 0}`);
    
    for (const del of toDelete) {
      console.log(`  Deleting duplicate: ${del.id} - Body length: ${del.body?.length || 0}`);
      await db.collection("facts").doc(del.id).delete();
      deletedCount++;
    }
  }

  console.log(`Deduplication complete. Deleted ${deletedCount} duplicate records.`);
}

main().catch(console.error);
