import { createRelease } from "./src/lib/firestore.ts";

async function run() {
  await createRelease({
    title: "1555문항 통합 DB 반영 (전수검사 완료)",
    notes: "58회~78회 전체 문항(심화 1050문항 / 기본 505문항, 총 1555문항)이 DB에 성공적으로 반영 및 AI 전수검사 되었습니다. 글자 깨짐 현상(줄바꿈 CSS)도 수정하여 안정성을 높였습니다.",
    addedCount: 1555
  });
  console.log("Release created");
}

run();
