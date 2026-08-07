import { getAllQuestions } from "../src/lib/firestore.ts";
import * as fs from "fs";

async function run() {
  const qs = await getAllQuestions();
  qs.sort((a, b) => a.id.localeCompare(b.id));

  const CHECKPOINT = "antigravity_checkpoint.json";
  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT)) {
    startIndex = JSON.parse(fs.readFileSync(CHECKPOINT, "utf-8")).lastIndex || 0;
  }

  if (startIndex >= qs.length) {
    console.log("ALL_DONE");
    return;
  }

  const chunkSize = 20;
  const endIndex = Math.min(startIndex + chunkSize, qs.length);
  const batch = qs.slice(startIndex, endIndex);

  const report = [];
  for (const q of batch) {
    report.push(`ID: ${q.id} | ${q.examRound}회 ${q.level} ${q.number}번`);
    report.push(`발문: ${q.stem}`);
    report.push(`지문: ${q.passage || q.imageDescription || "(없음)"}`);
    report.push(`선지:\n${q.choices.map(c => `  ${c.order + 1}) ${c.text}`).join('\n')}`);
    report.push(`정답: ${q.answerIndex + 1}`);
    report.push(`해설: ${q.explanation || "(해설 없음)"}`);
    report.push(`----------------------------------------`);
  }
  
  fs.writeFileSync("C:\\Users\\naoma\\.gemini\\antigravity-ide\\brain\\443473db-f9b2-4dda-aa4d-5b2b73cfdde7\\scratch_batch.txt", report.join('\n'), "utf-8");
  console.log(`BATCH_START ${startIndex} TO ${endIndex - 1}`);
  
  // Advance checkpoint
  fs.writeFileSync(CHECKPOINT, JSON.stringify({ lastIndex: endIndex }), "utf-8");
}

run();
