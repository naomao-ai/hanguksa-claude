import { linkAllQuestions } from "../src/lib/ai/link-facts.ts";
import { linkAllRelations } from "../src/lib/ai/link-relations.ts";
import { generateAllDetails } from "../src/lib/ai/generate-details.ts";
import { enrichAllQuestions } from "../src/lib/ai/enrich-questions.ts";

async function main() {
  console.log("🚀 [Phase 1] AI 데이터 보강 파이프라인 시작...");

  console.log("\n[1/4] 문항 ↔ 연표 연결 (link-facts)");
  const r1 = await linkAllQuestions("missing");
  console.log(`✅ 완료: 대상 ${r1.processed}개 중 ${r1.linked}개 연결됨`);

  console.log("\n[2/4] 연표 간 인과관계 연결 (link-relations)");
  const r2 = await linkAllRelations("missing");
  console.log(`✅ 완료: 대상 ${r2.processed}개 중 ${r2.linked}개 연결됨`);

  console.log("\n[3/4] 연표 상세설명 생성 (generate-details)");
  const r3 = await generateAllDetails("missing");
  console.log(`✅ 완료: 대상 ${r3.processed}개 중 ${r3.written}개 작성됨`);

  console.log("\n[4/4] 문항 심층 해설 생성 (enrich-questions)");
  const r4 = await enrichAllQuestions("missing");
  console.log(`✅ 완료: 대상 ${r4.processed}개 중 ${r4.enriched}개 생성됨`);

  console.log("\n🎉 모든 파이프라인 작업이 완료되었습니다.");
}

main().catch(console.error);
