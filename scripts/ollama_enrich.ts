import { getAllQuestions, setQuestionWikiMeta } from "../src/lib/firestore.ts";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "hf.co/lmstudio-community/gemma-4-E4B-it-GGUF:latest";

const ENRICH_SYSTEM = `당신은 한국사능력검정시험(한능검) 전문 강사이자 위키 작성자입니다.
주어진 기출문제를 분석하여 수험생에게 실질적인 도움이 되는 위키용 심층 해설 데이터를 생성합니다.
- historicalContext: 단순 해설이 아니라, 이 사건/인물/제도가 왜 등장했는지(배경), 어떻게 전개되었는지, 어떤 결과를 낳았는지 흐름을 2~3문장으로 설명합니다.
- commonMistakes: 오답 선지가 왜 매력적인지, 어떤 다른 사건과 헷갈리기 쉬운지 짚어줍니다.
- studyTip: 암기 팁, 두음자, 시대적 흐름 파악법 등을 제안합니다.
- relatedConcepts: 문제의 직접적 정답 외에도 함께 알아두면 좋은 연관 개념 키워드를 추출합니다.

반드시 아래 JSON 형식으로만 응답해야 합니다. 다른 말은 절대 추가하지 마세요.
{
  "historicalContext": "...",
  "commonMistakes": "...",
  "studyTip": "...",
  "relatedConcepts": ["키워드1", "키워드2", "키워드3"]
}`;

async function enrichWithOllama(question: any) {
  const userText = 
    `[문제]\n발문: ${question.stem}\n` +
    (question.passage ? `자료: ${question.passage}\n` : "") +
    (question.imageDescription ? `시각자료: ${question.imageDescription}\n` : "") +
    `선지:\n${(question.choices || []).map((c: any) => `  ${c.order}. ${c.text}`).join("\n")}\n` +
    `정답 인덱스: ${question.answerIndex}\n` +
    (question.explanation ? `해설: ${question.explanation}\n` : "") +
    (question.corePoint ? `AI핵심요약: ${question.corePoint.summary}\n` : "") +
    `주제태그: ${(question.topics || []).join(", ")}\n시대: ${question.era}\n` +
    `\n위 문제를 분석하여 지정된 JSON 형식으로 심층 해설 데이터를 생성하세요.`;

  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        system: ENRICH_SYSTEM,
        prompt: userText,
        stream: false,
        format: "json",
        options: {
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama Error: ${response.statusText}`);
    }

    const data = await response.json();
    const resultJson = JSON.parse(data.response.trim());
    
    // 검증 및 클리닝
    if (resultJson.historicalContext && resultJson.commonMistakes && resultJson.studyTip && Array.isArray(resultJson.relatedConcepts)) {
      const cleanMeta = {
        historicalContext: String(resultJson.historicalContext),
        commonMistakes: String(resultJson.commonMistakes),
        studyTip: String(resultJson.studyTip),
        relatedConcepts: resultJson.relatedConcepts.map((v: any) => String(v)).filter((v: string) => v.length > 0)
      };
      return cleanMeta;
    } else {
      console.error("Invalid JSON format from Ollama:", resultJson);
      return null;
    }
  } catch (err: any) {
    console.error(`Error querying Ollama for question ${question.id}:`, err.message);
    return null;
  }
}

async function main() {
  console.log("🚀 오프라인 AI(Ollama)를 이용한 wikiMeta 보강 파이프라인 시작...");
  const allQ = await getAllQuestions();
  const missing = allQ.filter(q => !q.wikiMeta);
  
  console.log(`총 ${missing.length}개의 문항이 wikiMeta가 누락되어 있습니다.`);
  
  let successCount = 0;
  for (let i = 0; i < missing.length; i++) {
    const q = missing[i];
    console.log(`[${i+1}/${missing.length}] 문항 ${q.id} 처리 중...`);
    const meta = await enrichWithOllama(q);
    
    if (meta) {
      try {
        await setQuestionWikiMeta(q.id, meta);
        console.log(`  ✅ 성공적으로 업데이트되었습니다.`);
        successCount++;
      } catch (dbErr: any) {
        console.error(`  ❌ DB 저장 실패 (${q.id}):`, dbErr.message);
      }
    } else {
      console.log(`  ❌ 처리에 실패했습니다.`);
    }
  }
  
  console.log(`\n🎉 작업 완료: 총 ${missing.length}개 중 ${successCount}개 문항 업데이트 성공.`);
}

main().catch(console.error);
