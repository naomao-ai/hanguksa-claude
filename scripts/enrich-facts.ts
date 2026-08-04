import { db } from "../src/lib/firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import "dotenv/config";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("=== 한국사 마스터 Fact 데이터 고도화 스크립트 ===");

  // 1. significance 필드가 없는 데이터 가져오기
  const snap = await db.collection("facts").get();
  
  const factsToProcess = snap.docs.filter(doc => {
    const data = doc.data();
    return !data.significance || data.keywords?.length === 0;
  });

  console.log(`총 ${snap.size}개 중 처리할 항목 수: ${factsToProcess.length}`);

  if (factsToProcess.length === 0) {
    console.log("처리할 항목이 없습니다. 스크립트를 종료합니다.");
    return;
  }

  // 2. 배치 처리 설정
  const BATCH_SIZE = 5;
  for (let i = 0; i < factsToProcess.length; i += BATCH_SIZE) {
    const batchDocs = factsToProcess.slice(i, i + BATCH_SIZE);
    console.log(`\n[${i + 1} ~ ${Math.min(i + BATCH_SIZE, factsToProcess.length)}] 항목 처리 중...`);
    
    await Promise.all(batchDocs.map(async (doc) => {
      const data = doc.data();
      try {
        const prompt = `
당신은 한국사 전문가입니다.
다음 한국사 사건/개념에 대해 다음 두 가지를 제공해 주세요.

사건명: ${data.title}
시대: ${data.era}
요약: ${data.body}
상세설명: ${data.detail?.join(" ")}

요청사항:
1. significance (한국사적 평가 및 의의, 딱 1~2문장으로 핵심만)
2. keywords (해당 사건의 핵심 키워드 3~5개 배열 형식)

출력 형식 (반드시 JSON 형식으로 응답할 것):
{
  "significance": "여기에 평가 및 의의 작성",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}
        `;

        const msg = await client.messages.create({
          model: process.env.CLAUDE_MODEL || "claude-3-haiku-20240307",
          max_tokens: 300,
          temperature: 0.2,
          system: "응답은 반드시 유효한 JSON 형식만 출력해야 합니다.",
          messages: [{ role: "user", content: prompt }]
        });

        const content = msg.content[0].type === "text" ? msg.content[0].text : "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          
          await db.collection("facts").doc(doc.id).update({
            significance: result.significance,
            keywords: data.keywords?.length > 0 ? data.keywords : result.keywords, // 기존 키워드 있으면 보존
          });
          console.log(`✅ [${data.title}] 업데이트 완료`);
        } else {
          console.log(`❌ [${data.title}] JSON 파싱 실패`);
        }
      } catch (err: any) {
        console.error(`❌ [${data.title}] 처리 중 오류 발생:`, err.message);
      }
    }));
    
    // API 속도 제한을 피하기 위한 딜레이
    if (i + BATCH_SIZE < factsToProcess.length) {
      console.log(`대기 중... (2초)`);
      await delay(2000);
    }
  }

  console.log("\n모든 처리가 완료되었습니다.");
}

main().catch(console.error);
