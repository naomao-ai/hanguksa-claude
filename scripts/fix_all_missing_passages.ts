import { getAllQuestions, updateQuestion } from "../src/lib/firestore.ts";

async function run() {
  const qs = await getAllQuestions();
  let updatedCount = 0;
  const regex = /\([가-마]\)/;

  for (const q of qs) {
    if (q.imageUrl && !q.passage && q.stem.match(regex)) {
      if (q.imageDescription) {
        console.log(`Updating ${q.examRound}회 ${q.level} ${q.number}번...`);
        const newPassage = "[그림 해설] " + q.imageDescription;
        await updateQuestion(q.id, {
          ...q,
          passage: newPassage,
          level: q.level,
          stem: q.stem,
          choices: q.choices,
          answerIndex: q.answerIndex,
          era: q.era
        });
        updatedCount++;
      }
    }
  }

  console.log(`Successfully updated ${updatedCount} questions.`);
}

run();
