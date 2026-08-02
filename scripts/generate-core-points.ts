import Anthropic from "@anthropic-ai/sdk";
import { db } from "../src/lib/firebase-admin.ts";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function main() {
  const args = process.argv.slice(2);
  const roundArg = args.findIndex((a) => a === "--round");
  if (roundArg === -1 || !args[roundArg + 1]) {
    console.error("Usage: node scripts/generate-core-points.ts --round <number>");
    process.exit(1);
  }
  const round = parseInt(args[roundArg + 1], 10);
  console.log(`Fetching questions for round ${round}...`);

  const snapshot = await db.collection("questions").where("examRound", "==", round).get();
  if (snapshot.empty) {
    console.log(`No questions found for round ${round}.`);
    return;
  }

  const docs = snapshot.docs;
  console.log(`Found ${docs.length} questions. Generating core points...`);

  let count = 0;
  for (const doc of docs) {
    const data = doc.data();
    if (data.corePoint) {
      console.log(`Question ${doc.id} already has corePoint. Skipping.`);
      continue;
    }

    const { stem, imageDescription, passage, choices, answerIndex } = data;
    const choiceText = (choices || []).map((c: any) => `${c.order + 1}번: ${c.text}`).join('\\n');

    const prompt = `다음은 한국사능력검정시험 기출문제의 정보입니다.
[발문] ${stem}
[자료/사료] ${imageDescription || ""} ${passage || ""}
[선지]
${choiceText}

[정답] ${answerIndex + 1}번

위 정보를 바탕으로, 왜 정답이 ${answerIndex + 1}번인지 그 핵심 내용을 1~2문장으로 요약해 주세요. 중요 키워드 양옆에 **(마크다운 볼드)를 붙여 강조해 주세요. (예: 정답은 **최충헌**의 **교정도감** 설치입니다.)`;

    try {
      const res = await client.messages.create({
        model: MODEL,
        max_tokens: 150,
        temperature: 0.1,
        system: "당신은 한국사 강사입니다. 학생이 빠르게 핵심을 짚을 수 있도록 돕습니다.",
        messages: [{ role: "user", content: prompt }],
      });

      const corePoint = (res.content[0] as any).text.trim();
      
      await doc.ref.update({ corePoint });
      count++;
      console.log(`Updated ${doc.id}: ${corePoint}`);
      
      // Rate limiting prevention
      await new Promise(r => setTimeout(r, 1000));
    } catch (err: any) {
      console.error(`Failed to generate corePoint for ${doc.id}: ${err.message}`);
    }
  }

  console.log(`Finished updating ${count} questions.`);
}

main().catch(console.error);
