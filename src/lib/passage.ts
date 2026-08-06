// passage 앞머리의 대괄호 라벨을 분리한다.
// 한능검 자료는 [역사 신문]·[답사 보고서]·[가상 인터뷰]처럼 '자료 형식'을 제목으로
// 다는 경우가 많다 — 이건 자료 제목 badge로 승격해 본문과 구분해 보여준다.
// 반면 [해설]·[자료]처럼 형식이 아닌 일반 라벨은 본문을 가리키는 군더더기이므로 벗겨낸다.

// 자료 '형식/제목'이 아니라 본문을 두루뭉술하게 가리키는 일반 라벨 — 제목으로 쓰지 않고 제거.
const GENERIC_LABELS = new Set([
  "해설", "자료", "지문", "사료", "설명", "자료 설명", "보기", "본문", "제시문",
]);

export function parsePassage(passage: string): { label: string | null; body: string } {
  if (typeof passage !== "string") return { label: null, body: "" };
  const m = passage.match(/^\s*\[([^\]]{1,24})\]\s*/);
  if (!m) return { label: null, body: passage.trim() };
  const raw = m[1].trim();
  const body = passage.slice(m[0].length).trim();
  // 라벨을 떼면 본문이 사라지는(라벨뿐인) 경우는 원문 유지 — 정보 손실 방지.
  if (!body) return { label: null, body: passage.trim() };
  if (GENERIC_LABELS.has(raw)) return { label: null, body };
  return { label: raw, body };
}
