import { getAllQuestions } from "../src/lib/firestore.ts";
import * as fs from "fs";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = "qwen2.5:32b"; // we don't know the exact model, maybe "llama3" or "gemma2"

const CHECKPOINT_FILE = "validation_checkpoint.json";
const REPORT_FILE = "C:\\Users\\naoma\\.gemini\\antigravity-ide\\brain\\443473db-f9b2-4dda-aa4d-5b2b73cfdde7\\validation_report.md";

async function askOllama(prompt: string): Promise<{isCorrect: boolean, reason: string}> {
  // Let's try to query tags to find an available model first
  let modelToUse = "llama3";
  try {
    const tagsRes = await fetch("http://localhost:11434/api/tags");
    const tagsData = await tagsRes.json();
    if (tagsData.models && tagsData.models.length > 0) {
      modelToUse = tagsData.models[0].name; // Use the first available model
    }
  } catch (e) {
    // ignore
  }

  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modelToUse,
      prompt: prompt,
      stream: false,
      format: "json"
    })
  });

  if (!res.ok) {
    throw new Error(`Ollama Error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  return JSON.parse(data.response);
}

async function run() {
  const chunkSize = parseInt(process.argv[2] || "50", 10);
  
  // Load questions
  const qs = await getAllQuestions();
  qs.sort((a, b) => a.id.localeCompare(b.id));

  // Load checkpoint
  let startIndex = 0;
  if (fs.existsSync(CHECKPOINT_FILE)) {
    const cp = JSON.parse(fs.readFileSync(CHECKPOINT_FILE, "utf-8"));
    startIndex = cp.lastIndex || 0;
  }

  if (startIndex >= qs.length) {
    console.log("ALL_DONE");
    return;
  }

  // Initialize report if new
  if (startIndex === 0) {
    fs.writeFileSync(REPORT_FILE, "# 한국사능력검정시험 문항 전수검사(AI) 결과\n\n| 회차/번호 | O/X | 검수 의견 |\n| :--- | :---: | :--- |\n", "utf-8");
  }

  const endIndex = Math.min(startIndex + chunkSize, qs.length);
  console.log(`Processing from index ${startIndex} to ${endIndex - 1} using Local LLM via Ollama...`);

  for (let i = startIndex; i < endIndex; i++) {
    const q = qs[i];
    
    const prompt = `당신은 전문적인 한국사시험 문제 출제자이자 검수 위원입니다.
다음 문제와 해설을 읽고, 역사적 사실관계 오류, 오탈자, 논리적 비약 등 이상 여부를 검수해 주세요.

[문제 정보]
- 회차: ${q.examRound}회 ${q.level} ${q.number}번
- 발문: ${q.stem}
- 지문/그림해설: ${q.passage || q.imageDescription || "(없음)"}
- 선지:
${q.choices.map(c => `  ${c.order + 1}) ${c.text}`).join('\n')}
- 정답 번호: ${q.answerIndex + 1}
- 해설: ${q.explanation || "(해설 없음)"}

[요청 사항]
오류가 전혀 없고 완벽하면 "O", 오류(또는 수정 권장 사항)가 있으면 "X"로 판정하고 이유를 1~2문장으로 간략히 적어주세요.
반드시 아래 JSON 형식으로만 응답하세요.
{
  "isCorrect": true,
  "reason": "..."
}`;

    try {
      const result = await askOllama(prompt);
      const ox = result.isCorrect ? "O" : "X";
      const reason = result.reason.replace(/\n/g, " ");
      
      const line = `| ${q.examRound}회 ${q.level} ${q.number}번 | **${ox}** | ${reason} |\n`;
      fs.appendFileSync(REPORT_FILE, line, "utf-8");
      
      process.stdout.write(ox);
    } catch (e: any) {
      console.error(`\nError on index ${i}:`, e.message);
      fs.appendFileSync(REPORT_FILE, `| ${q.examRound}회 ${q.level} ${q.number}번 | **ERR** | 로컬 모델 오류 |\n`, "utf-8");
    }
    
    // Save checkpoint
    fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify({ lastIndex: i + 1 }), "utf-8");
  }

  console.log(`\nChunk finished. Progress: ${endIndex} / ${qs.length}`);
  if (endIndex >= qs.length) {
    console.log("ALL_DONE");
  } else {
    console.log("MORE_LEFT");
  }
}

run();
