import { NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const snap = await db.collection("facts").get();
    const facts: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const titleMap = new Map<string, any[]>();
    for (const f of facts) {
      if (!f.title) continue;
      const key = `${f.era}:${f.title}`;
      if (!titleMap.has(key)) titleMap.set(key, []);
      titleMap.get(key)!.push(f);
    }

    const duplicates = Array.from(titleMap.entries()).filter(([k, v]) => v.length > 1);
    const deletedIds: string[] = [];
    let keptCount = 0;

    for (const [key, list] of duplicates) {
      // Sort to keep the one with most details or keywords
      list.sort((a, b) => {
        const aScore = (a.body?.length || 0) + (a.detail?.length || 0) * 10;
        const bScore = (b.body?.length || 0) + (b.detail?.length || 0) * 10;
        return bScore - aScore;
      });

      const [keep, ...toDelete] = list;
      keptCount++;

      for (const del of toDelete) {
        await db.collection("facts").doc(del.id).delete();
        deletedIds.push(del.id);
      }
    }

    return NextResponse.json({
      message: "Deduplication complete",
      totalFactsBefore: facts.length,
      duplicateGroups: duplicates.length,
      deletedCount: deletedIds.length,
      deletedIds,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
