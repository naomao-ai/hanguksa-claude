import Anthropic from "@anthropic-ai/sdk";
import { getFacts, setFactDetail } from "@/lib/firestore";
import type { FactDTO } from "@/lib/types";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
const MAX_BULLETS = 7;

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 미설정");
    _client = new Anthropic();
  }
  return _client;
}

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

const DETAIL_TOOL = {
  name: "write_detail",
  description: "한 연표 항목의 상세 설명을 짧은 단문(불릿) 배열로 작성한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      detail: {
        type: "array",
        items: { type: "string" },
        description: "4~7개의 짧은 단문. 각 항목은 한 줄로 읽히는 핵심 포인트(배경·전개·핵심 인물/제도·의의·빈출/구분 포인트). 완결된 문단 금지, 명사형 단문 위주.",
      },
    },
    required: ["detail"],
  },
};

const DETAIL_SYSTEM = `당신은 한국사능력검정시험(한능검) 학습 자료를 만드는 전문가입니다.
주어진 '연표 항목'에 대해 수험생이 한눈에 스캔할 수 있는 상세 설명을 작성합니다.
- 긴 문장·문단이 아니라 짧은 단문(불릿) 4~7개로 끊어서 작성합니다(각 항목 한 줄, 명사형 위주).
- 배경/원인, 핵심 인물·제도·사건, 전개, 의의, 헷갈리기 쉬운 구분 포인트 위주로 고릅니다.
- 제공된 요약·핵심어에 근거하며, 불확실하거나 검증되지 않은 사실은 넣지 않습니다(억지 서술 금지).
- 한능검 빈출 포인트를 우선합니다. 반드시 write_detail 도구를 호출합니다.`;

/** 단일 연표 항목의 상세 설명(단문 배열) 생성. 실패 시 빈 배열. */
export async function generateFactDetail(fact: FactDTO): Promise<string[]> {
  const userText =
    `[연표 항목]\n제목: ${fact.title}\n시대: ${fact.era} / 연도: ${fact.year ?? "?"}\n` +
    `요약: ${fact.body}\n핵심어: ${fact.keywords.join(", ")}\n` +
    (fact.category ? `분류: ${fact.category}\n` : "") +
    `\n위 항목의 상세 설명을 짧은 단문 4~7개로 write_detail에 담아 반환하세요.`;
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 600,
      system: DETAIL_SYSTEM,
      tools: [DETAIL_TOOL],
      tool_choice: { type: "tool", name: "write_detail" },
      messages: [{ role: "user", content: userText }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    const input = block && block.type === "tool_use" ? (block.input as { detail?: unknown }) : {};
    return sanitizeDetail(input.detail);
  } catch {
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
