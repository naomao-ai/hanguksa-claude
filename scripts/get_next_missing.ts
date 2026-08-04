import { getAllQuestions } from "../src/lib/firestore.ts";

async function main() {
  const allQ = await getAllQuestions();
  // wikiMeta가 없는 항목 중 첫 5개를 가져옴
  const missing = allQ.filter((q) => !q.wikiMeta).slice(0, 10);
  
  if (missing.length === 0) {
    console.log(JSON.stringify({ done: true }));
    return;
  }
  
  console.log(JSON.stringify({ done: false, data: missing }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
