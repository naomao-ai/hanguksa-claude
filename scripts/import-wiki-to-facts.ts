/**
 * Firestore의 `questions` 컬렉션을 스캔하여 `wikiMeta`가 존재하는 문항들의
 * historicalContext, studyTip, commonMistakes 등을 `facts` 컬렉션으로 복사(Upsert)합니다.
 * 이를 통해 RAG 검색 시 문항 풀이와 독립적으로도 이 고급 맥락을 활용할 수 있습니다.
 *
 * 실행: npm run import:wiki-facts
 */
import { db } from "../src/lib/firebase-admin.ts";

async function main() {
  console.log("Firestore에서 wikiMeta가 포함된 questions를 가져옵니다...");
  const snap = await db.collection("questions").get();
  const questions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const targets = questions.filter((q: any) => q.wikiMeta && q.wikiMeta.historicalContext);
  console.log(`총 ${questions.length}개의 문항 중 wikiMeta가 존재하는 문항: ${targets.length}개`);

  let successCount = 0;
  let errorCount = 0;

  for (const q of targets) {
    try {
      const wikiMeta = q.wikiMeta;
      const docId = `wiki-${q.id}`;
      
      const relatedConcepts = wikiMeta.relatedConcepts || [];
      const title = relatedConcepts.length > 0 
        ? `[학습 맥락] ${relatedConcepts[0]}`
        : `[학습 맥락] 문항 ${q.id}`;
        
      let body = wikiMeta.historicalContext || "";
      if (wikiMeta.studyTip) body += `\n\n[암기 팁] ${wikiMeta.studyTip}`;
      if (wikiMeta.commonMistakes) body += `\n\n[오답 노트] ${wikiMeta.commonMistakes}`;

      const factData = {
        title,
        body,
        keywords: relatedConcepts,
        kind: "concept",
        era: "unknown",
        year: null,
        yearDisplay: null,
        detail: [wikiMeta.historicalContext],
        source: "WikiMeta",
        sourceUrl: `/exam?q=${q.id}`, // 해당 문항 링크로 유도 가능
      };

      await db.collection("facts").doc(docId).set(factData, { merge: true });
      successCount++;

      if (successCount % 20 === 0) {
        console.log(`진행 상황: ${successCount}건 적재 완료...`);
      }
    } catch (err) {
      console.error(`적재 실패 (${q.id}):`, err);
      errorCount++;
    }
  }

  console.log("=== 적재 완료 ===");
  console.log(`성공: ${successCount}건`);
  console.log(`실패: ${errorCount}건`);
}

main().catch(console.error);
