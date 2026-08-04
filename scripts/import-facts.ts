/**
 * 우리역사넷에서 스크래핑 후 AI 메타데이터 보강을 마친 facts_for_firestore.json 을
 * 기존 facts 컬렉션에 병합(Upsert)하는 스크립트입니다.
 *
 * 실행: npm run import:facts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { db } from "../src/lib/firebase-admin.ts";

// URL에서 ID(levelId) 추출하는 함수
function extractIdFromUrl(url: string): string | null {
  const match = url.match(/levelId=([^&]+)/);
  return match ? match[1] : null;
}

async function main() {
  const filePath = resolve("C:/00.파이썬/03.RAG-HANKUKSA/facts_for_firestore.json");
  console.log(`파일을 읽는 중: ${filePath}`);
  
  let rawData = "";
  try {
    rawData = readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error("파일을 읽을 수 없습니다. 아직 전처리 작업이 완료되지 않았을 수 있습니다:", err);
    process.exit(1);
  }

  const items = JSON.parse(rawData);
  console.log(`총 ${items.length}개의 데이터를 로드했습니다. Firestore에 적재를 시작합니다...`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  // Firestore 배치 처리를 사용하면 더 빠르지만, 단순화를 위해 하나씩 덮어쓰기 (upsert)
  for (const item of items) {
    try {
      const sourceUrl = item.sourceUrl || "";
      const levelId = extractIdFromUrl(sourceUrl);
      
      let docId = "";
      if (levelId) {
        docId = `ourhist-${levelId}`; // 예: ourhist-kc_o300600
      } else {
        // URL이 없거나 ID 추출 실패 시 연도+제목 기반 slug 생성
        const fallbackYear = item.year || 0;
        const cleanTitle = item.title.replace(/\s+/g, '-').replace(/[^\w가-힣-]/g, '');
        docId = `ourhist-${fallbackYear}-${cleanTitle}`;
      }

      await db.collection("facts").doc(docId).set(item, { merge: true });
      successCount++;

      if (successCount % 50 === 0) {
        console.log(`진행 상황: ${successCount}건 적재 완료...`);
      }
    } catch (err) {
      console.error(`적재 실패 (${item.title}):`, err);
      errorCount++;
    }
  }

  console.log("=== 적재 완료 ===");
  console.log(`성공: ${successCount}건`);
  console.log(`실패: ${errorCount}건`);
}

main().catch(console.error);
