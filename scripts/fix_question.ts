import { getQuestions, updateQuestion } from "../src/lib/firestore.ts";

async function run() {
  const qs = await getQuestions({ round: 67 });
  const q7 = qs.find(q => q.number === 7);
  if (!q7) {
    console.log("Q7 not found in round 67");
    return;
  }
  
  if (q7.imageDescription) {
    console.log("Found Q7! Current passage:", q7.passage);
    console.log("Updating passage with:", q7.imageDescription);
    await updateQuestion(q7.id, {
      ...q7,
      passage: "[그림 해설] " + q7.imageDescription,
      level: q7.level,
      stem: q7.stem,
      choices: q7.choices,
      answerIndex: q7.answerIndex,
      era: q7.era
    });
    console.log("Updated successfully!");
  } else {
    console.log("No imageDescription found");
  }
}

run();
