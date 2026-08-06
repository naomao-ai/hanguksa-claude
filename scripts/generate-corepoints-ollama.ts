// corePoint(문제 풀이 화면 해설) 대량 생성 — 로컬 Ollama(무료).
// 기존 275개와 동일한 객체 포맷 {summary, keywords, related}을 유지한다.
// 정답 선지를 프롬프트에 명시해 소형 모델의 사실 오류를 최소화한다.
//
// 사용법:
//   node --env-file=.env.local --experimental-strip-types scripts/generate-corepoints-ollama.ts [--limit N] [--dry]
//   --limit N : 최대 N개만 처리(샘플 검증용). 미지정 시 전체 미보유 문항.
//   --dry     : DB 저장 없이 생성 결과만 출력.
import { db } from "../src/lib/firebase-admin.ts";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "hf.co/lmstudio-community/gemma-4-E4B-it-GGUF:latest";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const limIdx = args.indexOf("--limit");
const LIMIT = limIdx >= 0 && args[limIdx + 1] ? parseInt(args[limIdx + 1], 10) : Infinity;

const SYSTEM = `당신은 한국사능력검정시험(한능검) 전문 강사입니다.
주어진 기출문제와 '정답'을 근거로, 학생이 왜 그것이 정답인지 핵심을 빠르게 짚도록 돕는 해설을 작성합니다.
- summary: 정답이 왜 정답인지 그 핵심 근거를 1~2문장으로 요약합니다. 가장 중요한 키워드 1~3개는 양옆에 **를 붙여 마크다운 볼드로 강조합니다.
- keywords: 발문·자료·정답 선지에 실제로 등장한 표현만 골라 핵심 키워드 3개를 뽑습니다. 새로운 용어를 만들어 내지 마세요.
- related: 확실히 아는 연관 사실만 1문장으로 덧붙입니다. 확실하지 않으면 빈 문자열("")로 둡니다.
- 반드시 주어진 정답에 부합하는 내용만 쓰고, 확실하지 않은 사실이나 없는 용어를 지어내지 않습니다.
반드시 아래 JSON 형식으로만 응답하세요. 다른 말은 절대 추가하지 마세요.
{"summary":"...","keywords":["k1","k2","k3"],"related":"..."}`;

// 모델이 "문제를 알 수 없다"는 식으로 회피 응답한 경우 — 저장 금지 신호.
const REFUSAL_RE = /정보\s*부족|제공되지|제공해|다시\s*제공|확인되지|알 수 없|불가능합니다|문제를 알려/;

function buildPrompt(q: any): string {
  const choices = (q.choices || [])
    .map((c: any, i: number) => `  ${i + 1}번: ${c.text || "[이미지 선지]"}`)
    .join("\n");
  const answerText = (q.choices?.[q.answerIndex]?.text) || `${q.answerIndex + 1}번`;
  return (
    `[발문] ${q.stem}\n` +
    (q.passage ? `[자료/사료] ${q.passage}\n` : "") +
    (q.imageDescription ? `[시각자료 설명] ${q.imageDescription}\n` : "") +
    `[선지]\n${choices}\n` +
    `[정답] ${q.answerIndex + 1}번 — ${answerText}\n` +
    `[시대] ${q.era ?? "?"}\n` +
    `\n위 정답을 근거로 해설 JSON을 생성하세요.`
  );
}

function validate(j: any): { summary: string; keywords: string[]; related: string } | null {
  if (!j || typeof j.summary !== "string" || !j.summary.trim()) return null;
  const summary = j.summary.trim();
  // 모델이 정답을 못 짚고 회피한 응답은 저장하지 않는다(오해설 방지).
  if (REFUSAL_RE.test(summary)) return null;
  // keywords: 문장형(길이>16)·빈값 제거. 소형 모델이 문장을 통째로 넣는 경우 컷.
  const keywords = Array.isArray(j.keywords)
    ? j.keywords.map((v: any) => String(v).trim()).filter((v: string) => v && v.length <= 16).slice(0, 4)
    : [];
  // related: 모델 자유 생성분은 사실 환각(시대 오인 등)이 실측되어 저장하지 않는다.
  // CorePoint 컴포넌트는 related가 비면 해당 섹션을 렌더하지 않는다.
  return { summary, keywords, related: "" };
}

async function callOllama(q: any) {
  const res = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      system: SYSTEM,
      prompt: buildPrompt(q),
      stream: false,
      format: "json",
      options: { temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return validate(JSON.parse(String(data.response).trim()));
}

async function main() {
  console.log(`🚀 corePoint 생성 (Ollama)${DRY ? " [DRY]" : ""}${LIMIT !== Infinity ? ` limit=${LIMIT}` : ""}`);
  const snap = await db.collection("questions").get();
  const all = snap.docs.map((d) => ({ id: d.id, ref: d.ref, ...(d.data() as any) }));
  // 유령/불량 문서(stem·선지 없음)는 대상에서 제외 — 해설 생성 의미 없음.
  const isValidQ = (q: any) =>
    typeof q.stem === "string" && q.stem.trim() && Array.isArray(q.choices) && q.choices.length >= 2;
  const skippedGhost = all.filter((q) => (q.corePoint == null || q.corePoint === "") && !isValidQ(q));
  const targets = all
    .filter((q) => (q.corePoint == null || q.corePoint === "") && isValidQ(q))
    .slice(0, LIMIT);
  console.log(`대상: ${targets.length}문항 (전체 ${all.length}, 불량문항 제외 ${skippedGhost.length})`);
  if (skippedGhost.length) console.log(`  제외된 불량문항 id: ${skippedGhost.map((q) => q.id).join(", ")}`);
  console.log("");

  let ok = 0, fail = 0;
  for (let i = 0; i < targets.length; i++) {
    const q = targets[i];
    const label = `[${i + 1}/${targets.length}] ${q.examRound ?? "?"}회 ${q.number ?? "?"}번`;
    try {
      const cp = await callOllama(q);
      if (!cp) { fail++; console.log(`${label} ❌ 형식 불량`); continue; }
      if (DRY) {
        console.log(`${label} ✅ (dry)\n  summary: ${cp.summary}\n  keywords: ${cp.keywords.join(", ")}\n  related: ${cp.related}`);
      } else {
        await q.ref.update({ corePoint: cp });
        if ((i + 1) % 25 === 0 || i === targets.length - 1) console.log(`${label} ✅ (누적 ${ok + 1})`);
      }
      ok++;
    } catch (e: any) {
      fail++;
      console.log(`${label} ❌ ${e.message}`);
    }
  }
  console.log(`\n🎉 완료: 성공 ${ok} / 실패 ${fail} / 대상 ${targets.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
