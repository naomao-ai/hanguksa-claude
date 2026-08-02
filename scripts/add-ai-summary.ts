import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || "claude-haiku-3-5";

async function processFile(filePath: string) {
  console.log(`Processing ${filePath}...`);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  let updatedCount = 0;

  for (const q of data.questions) {
    if (q.corePoint && typeof q.corePoint === "object" && q.corePoint.summary) {
      // Already has the correct structure
      continue;
    }

    const { stem, imageDescription, passage, choices, answerIndex } = q;
    const choiceText = (choices || []).map((c: any, i: number) => `${i + 1}번: ${typeof c === "string" ? c : c.text}`).join('\n');

    const prompt = `다음은 한국사능력검정시험 기출문제의 정보입니다.
[발문] ${stem}
[자료/사료] ${imageDescription || ""} ${passage || ""}
[선지]
${choiceText}

[정답] ${answerIndex + 1}번

위 정보를 바탕으로 다음 세 가지 항목을 작성해주세요:
1. 핵심요약: 왜 정답인지 1~2줄로 요약 (중요 키워드는 양옆에 **를 붙여 강조, 예: **최충헌**)
2. 핵심키워드: 문제와 답과 관련된 키워드 1~3개 (배열)
3. 연관내용: 관련 배경지식이나 추가 설명 1~2줄

반드시 아래 JSON 형식으로만 응답해주세요 (마크다운 백틱 없이 순수 JSON만 출력):
{
  "summary": "핵심요약 내용...",
  "keywords": ["키워드1", "키워드2"],
  "related": "연관내용..."
}`;

    try {
      const res = await client.messages.create({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 300,
        temperature: 0.2,
        system: "당신은 한국사 강사입니다. 학생이 빠르게 핵심을 짚을 수 있도록 돕습니다.",
        messages: [{ role: "user", content: prompt }],
      });

      const text = (res.content[0] as any).text.trim();
      const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
      
      const corePoint = JSON.parse(jsonStr);
      q.corePoint = corePoint;
      updatedCount++;
      console.log(`  Updated Q${q.number || '?'}`);
      
      // Delay to avoid rate limits (250ms)
      await new Promise(r => setTimeout(r, 250));
    } catch (err: any) {
      console.error(`  Failed to generate corePoint for Q${q.number}: ${err.message}`);
    }
  }

  if (updatedCount > 0) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    console.log(`Saved ${updatedCount} updates to ${filePath}`);
  } else {
    console.log(`No updates needed for ${filePath}`);
  }
}

async function main() {
  const importDir = path.join(process.cwd(), "_import");
  const dirs = fs.readdirSync(importDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d+[gs]?$/.test(d.name))
    .map(d => d.name);
    
  for (const dirName of dirs) {
    const analysisPath = path.join(importDir, dirName, "analysis.json");
    if (fs.existsSync(analysisPath)) {
      await processFile(analysisPath);
    }
  }
}

main().catch(console.error);
