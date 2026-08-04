import { getFacts, setFactDetail } from "@/lib/firestore";
import type { FactDTO } from "@/lib/types";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "hf.co/lmstudio-community/gemma-4-E4B-it-GGUF:latest";
const MAX_BULLETS = 7;

/** AI 반환값(상세 설명 단문 배열)을 정제: trim·빈값/비문자열 제거·중복 제거·상한. 순수 함수. */
export function sanitizeDetail(returned: unknown, max: number = MAX_BULLETS): string[] {
  if (!Array.isArray(returned)) return [];
  const out: string[] = [];
  for (const v of returned) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s || out.includes(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

const DETAIL_SYSTEM = `당신은 한국사능력검정시험(한능검) 전문 강사이자 백과사전 집필자입니다.
주어진 사건/인물/제도에 대해 수험생과 일반인이 쉽게 이해할 수 있는 상세한 해설을 작성합니다.
- 배경(원인), 전개 과정, 결과 및 의의를 포함하여 작성합니다.
- 분량은 3~5문장 내외로 서술합니다.
- 반드시 다음과 같은 JSON 형식으로만 응답해야 합니다:
{
  "details": ["문장1", "문장2", "문장3", ...]
}`;

/** 단일 연표 항목의 상세 설명(단문 배열) 생성. 실패 시 빈 배열. */
export async function generateFactDetail(fact: FactDTO): Promise<string[]> {
  const userText =
    `[연표 항목]\n제목: ${fact.title}\n시대: ${fact.era} / 연도: ${fact.year ?? "?"}\n` +
    `요약: ${fact.body}\n핵심어: ${fact.keywords.join(", ")}\n` +
    (fact.category ? `분류: ${fact.category}\n` : "") +
    `\n위 항목의 상세 설명을 단문 배열 형태로 JSON 필드 details에 담아 반환하세요.`;
  try {
    const response = await fetch(OLLAMA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        system: DETAIL_SYSTEM,
        prompt: userText,
        stream: false,
        format: "json",
        options: { temperature: 0.2 }
      })
    });

    if (!response.ok) throw new Error("Ollama fetch failed");
    const data = await response.json();
    const resultJson = JSON.parse(data.response.trim());
    return sanitizeDetail(resultJson.details);
  } catch (err: any) {
    console.error("generateFactDetails Error:", err.message);
    return [];
  }
}

/** 일괄 생성: missing=detail 비어있는 항목만, all=전체. 순차 처리. */
export async function generateAllDetails(
  mode: "missing" | "all"
): Promise<{ processed: number; written: number }> {
  const facts = await getFacts();
  const targets = facts.filter((f) => mode === "all" || f.detail.length === 0);
  let written = 0;
  for (const f of targets) {
    const detail = await generateFactDetail(f);
    if (detail.length > 0) {
      await setFactDetail(f.id, detail);
      written++;
    }
  }
  return { processed: targets.length, written };
}
