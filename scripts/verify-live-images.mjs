// 업로드 후 라이브 이미지 커버리지 검증 (import-exam 루틴의 사후 게이트)
//
// 배경: import-exam의 dry-run/upload 게이트는 "로컬 크롭이 비었는지"를 막지만,
// 크롭이 잡혔어도 firestore.ts의 Storage 업로드가 실패하면 imageUrl이 라이브에
// 반영되지 않을 수 있다. 이 스크립트는 프로덕션 API를 직접 조회해, 삽화가 의도된
// 문항(imageDescription 보유)이 실제로 imageUrl을 가졌는지, 그림 선지 문항의 각
// 선지가 imageUrl을 가졌는지 확인한다. 라이브는 imageBox·imageSourceIndex·choiceKind를
// 스트립하므로 imageDescription과 choices의 형태(객체=이미지 선지)를 신호로 쓴다.
//
// 사용법:
//   node scripts/verify-live-images.mjs --round <N> --level <SIMHWA|GIBON> [--base <url>]
// 종료코드: 0=정상, 1=결손 감지, 2=사용법/조회 오류.

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d;
};

const round = opt("round");
const level = (opt("level", "SIMHWA") || "SIMHWA").toUpperCase();
const base = opt("base", "https://hanguksa-198132893049.asia-northeast3.run.app");

if (!round) {
  console.error("사용법: node scripts/verify-live-images.mjs --round <N> --level <SIMHWA|GIBON> [--base <url>]");
  process.exit(2);
}

const url = `${base}/api/questions?round=${round}&level=${level}&limit=200`;
let arr;
try {
  const res = await fetch(url);
  const j = await res.json();
  arr = j.questions ?? j;
} catch (e) {
  console.error(`❌ 라이브 조회 실패: ${e instanceof Error ? e.message : e}`);
  process.exit(2);
}
if (!Array.isArray(arr) || arr.length === 0) {
  console.error(`❌ ${round}회 ${level}: 라이브에 문항이 없습니다.`);
  process.exit(1);
}

const expectCount = Number(opt("count", "50")) || 50; // 기대 문항 수(기본 50)

const figMissing = [];
const choiceMissing = [];
const badAnswer = [];
const nums = [];
for (const q of arr) {
  const n = q.number ?? q.questionNumber ?? "?";
  if (typeof n === "number") nums.push(n);
  // 발문 삽화: 라이브에서 imageDescription이 유일한 "삽화 의도" 신호.
  if (q.imageDescription && !q.imageUrl) figMissing.push(n);
  // 그림 선지: 라이브는 텍스트 선지도 {text, imageUrl:null} 객체로 저장하므로,
  // "선지 중 하나라도 imageUrl이 있는" 문항만 이미지-선지 문항으로 간주한다.
  // 그런 문항에서 imageUrl이 빈 선지가 있으면 진짜 결손(부분 누락).
  let nChoices = 0;
  if (Array.isArray(q.choices)) {
    nChoices = q.choices.length;
    const isImageChoice = q.choices.some((c) => c && typeof c === "object" && c.imageUrl);
    if (isImageChoice) {
      const miss = [];
      q.choices.forEach((c, k) => {
        if (!c || typeof c !== "object" || !c.imageUrl) miss.push(k + 1);
      });
      if (miss.length) choiceMissing.push(`${n}(선지 ${miss.join(",")})`);
    }
  }
  // answerIndex 범위 (라이브 반영본에서 최종 확인 — 정답이 선지 범위 안인지)
  if (!Number.isInteger(q.answerIndex) || q.answerIndex < 0 || q.answerIndex >= nChoices) {
    badAnswer.push(`${n}(idx ${q.answerIndex}/선지 ${nChoices})`);
  }
}

// 회차 완결성: 문항 수 · 번호 1..N 유일·연속 (반쪽 회차·부분 업로드 검출)
const countMismatch = arr.length !== expectCount;
const numSet = new Set(nums);
const dupNums = nums.filter((n, i) => nums.indexOf(n) !== i);
const gapNums = [];
for (let i = 1; i <= expectCount; i++) if (!numSet.has(i)) gapNums.push(i);

console.log(`라이브 ${round}회 ${level}: 문항 ${arr.length}개 (기대 ${expectCount})`);
if (countMismatch) console.log(`  ⚠ 문항 수 불일치: ${arr.length} ≠ ${expectCount} (부분 업로드/반쪽 회차 의심)`);
if (dupNums.length) console.log(`  ⚠ 문항 번호 중복: ${[...new Set(dupNums)].join(",")}`);
if (gapNums.length) console.log(`  ⚠ 문항 번호 누락(1..${expectCount}): ${gapNums.join(",")}`);
if (badAnswer.length) console.log(`  ⚠ answerIndex 범위 오류 ${badAnswer.length}문항: ${badAnswer.join(",")}`);
if (figMissing.length)
  console.log(`  ⚠ 발문삽화 imageUrl 결손 ${figMissing.length}문항: ${figMissing.join(",")}`);
if (choiceMissing.length)
  console.log(`  ⚠ 그림선지 imageUrl 결손 ${choiceMissing.length}문항: ${choiceMissing.join(",")}`);

const anyDefect =
  countMismatch || dupNums.length || gapNums.length || badAnswer.length || figMissing.length || choiceMissing.length;
if (!anyDefect) {
  console.log("  ✅ 라이브 정합성 정상 — 문항 수·번호 집합·answerIndex·이미지 커버리지 전량 통과.");
  process.exit(0);
}
console.log(
  "❌ 라이브 결함 감지. 문항수·번호 결함은 부분 업로드(반쪽 회차) 신호 — 재업로드 필요.\n" +
    "   imageDescription만 있고 삽화가 실제로 없는 문항이면 이미지 결손은 정상일 수 있으니 원본 대조.\n" +
    "   진짜 결손이면 좌표 보강 후 --update(제자리 교체)로 재반영."
);
process.exit(1);
