import { enrichAllQuestions } from "../src/lib/ai/enrich-questions.ts";

async function main() {
  console.log("시작: 누락된 모든 문항에 대해 wikiMeta 생성을 진행합니다...");
  const result = await enrichAllQuestions("missing");
  console.log(`완료! 대상 ${result.processed}개 중 ${result.enriched}개 항목에 wikiMeta 생성 성공.`);
}

main().catch(console.error);
