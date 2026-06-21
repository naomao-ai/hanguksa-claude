import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

// 제78회 심화 (2026 시행) — 업로드된 문제지/답지에서 전사.
// 답지 시각 검증으로 확정한 50문항 정답(1-base): 아래 ANSWERS.
// 정답 인덱스는 (정답-1)로 저장. 전사 완료 문항만 questions에 포함(점진 추가).
const ROUND = 78;
const ANSWERS = [
  5, 2, 1, 5, 2, 4, 4, 3, 3, 4, // 1-10
  4, 3, 5, 3, 4, 3, 5, 2, 1, 5, // 11-20
  3, 4, 3, 5, 3, 4, 2, 2, 1, 2, // 21-30
  4, 3, 2, 4, 3, 1, 3, 4, 2, 4, // 31-40
  2, 1, 1, 5, 5, 2, 2, 5, 2, 5, // 41-50
];
// 배점(1=10·2=30·3=10문항) → 난이도 매핑: 1점→2, 2점→3, 3점→4
const POINTS: Record<number, number> = {
  1: 1, 7: 1, 12: 1, 13: 1, 24: 1, 26: 1, 34: 1, 36: 1, 45: 1, 47: 1,
  2: 3, 4: 3, 19: 3, 20: 3, 21: 3, 30: 3, 35: 3, 48: 3,
};
const diffOf = (n: number) => ({ 1: 2, 3: 4 } as Record<number, number>)[POINTS[n] ?? 2] ?? 3;

type Q = {
  n: number; era: string; qType: string; topics: string[];
  stem: string; passage?: string; img?: string; choices: string[];
};

// 전사 완료 문항 (점진적으로 확장)
const questions: Q[] = [
  { n: 1, era: "prehistoric", qType: "자료제시형", topics: ["신석기", "가락바퀴", "빗살무늬 토기", "안도 조개더미"], img: "/exam78/q01.png",
    stem: "(가) 시대의 생활 모습으로 가장 적절한 것은?",
    passage: "여수 안도 조개더미 유적입니다. 이 유적에서는 농경과 목축이 시작된 (가) 시대의 인골과 조개팔찌 등이 출토되었습니다. 또한 덧무늬 토기, 눌러찍은무늬 토기 등을 통해 (가) 시대에는 빗살무늬 토기 이외에도 다양한 토기가 사용되었음을 알 수 있습니다.",
    choices: ["청동 방울 등을 의례 도구로 이용하였다.", "주먹도끼 등 뗀석기를 만들기 시작하였다.", "거푸집을 사용하여 세형 동검을 제작하였다.", "쟁기, 쇠스랑 등의 철제 농기구를 사용하였다.", "가락바퀴와 뼈바늘을 이용하여 옷을 만들었다."] },
  { n: 2, era: "gojoseon", qType: "순서나열형", topics: ["고조선", "위만", "우거왕", "진개"], img: "/exam78/q02.png",
    stem: "(가)~(다) 학생이 발표한 내용을 일어난 순서대로 옳게 나열한 것은?",
    passage: "(가) 연의 장수 진개가 고조선을 침략하였어요. (나) 우거왕이 한 무제가 파견한 군대에 맞서 싸웠어요. (다) 위만이 진번과 임둔을 복속시키고 세력을 확장하였어요.",
    choices: ["(가) - (나) - (다)", "(가) - (다) - (나)", "(나) - (가) - (다)", "(나) - (다) - (가)", "(다) - (가) - (나)"] },
  { n: 3, era: "gojoseon", qType: "자료제시형", topics: ["삼한", "부여", "소도", "영고"],
    stem: "(가), (나) 나라에 대한 설명으로 옳은 것은?",
    passage: "(가) 해마다 5월에 씨뿌리기를 마치고 귀신에게 제사를 지낸다. … 귀신을 믿기 때문에 국읍에 각각 한 사람씩을 세워서 천신에 대한 제사를 주관하니, 이를 천군이라 부른다. (나) 은력 정월에 하늘에 제사를 지내는 국중대회에서는 날마다 마시고 먹고 노래하고 춤추는데, 이를 영고라 한다. — 삼국지 위서 동이전",
    choices: ["(가) - 신성 지역인 소도가 있었다.", "(가) - 혼인 풍습으로 민며느리제가 있었다.", "(나) - 위화부, 영객부 등의 관청이 있었다.", "(나) - 왕 아래 상가, 대로, 패자 등의 관직이 있었다.", "(가), (나) - 읍락 간의 경계를 중시하는 책화가 있었다."] },
  { n: 4, era: "samguk", qType: "인물형", topics: ["성왕", "백제", "관산성 전투"], img: "/exam78/q04.png",
    stem: "밑줄 그은 '왕'에 대한 설명으로 옳은 것은?",
    passage: "우리 군이 관산성을 공격하여 김무력이 이끄는 신라군과 전투를 벌였다는데…/ 왕께서 소수의 보병과 기병을 거느리고 구천에 이르셨는데, 신라군의 기습을 받아 돌아가셨군. 결국 우리 군이 크게 패했군.",
    choices: ["수도를 웅진으로 옮겼다.", "백가의 난을 평정하였다.", "금마저에 미륵사를 창건하였다.", "고흥에게 서기를 편찬하게 하였다.", "달솔을 보내 고구려의 도살성을 점령하였다."] },
];

async function main() {
  await prisma.question.deleteMany({ where: { source: "EXAM78", examRound: ROUND } });

  for (const q of questions) {
    await prisma.question.create({
      data: {
        level: "SIMHWA", examRound: ROUND, examYear: 2026, number: q.n,
        stem: q.stem, passage: q.passage ?? null, imageUrl: q.img ?? null,
        explanation: null,
        answerIndex: ANSWERS[q.n - 1] - 1,
        era: q.era, topics: JSON.stringify(q.topics), qType: q.qType,
        difficulty: diffOf(q.n), source: "EXAM78",
        choices: { create: q.choices.map((text, order) => ({ text, order })) },
      },
    });
  }

  // 78회 릴리스 (멱등)
  await prisma.release.deleteMany({ where: { examRound: ROUND } });
  const last = await prisma.release.findFirst({ orderBy: { version: "desc" } });
  const total = await prisma.question.count();
  await prisma.release.create({
    data: {
      version: (last?.version ?? 0) + 1,
      title: `78회 심화 기출 반영`,
      notes: `제78회 심화 기출문제를 업로드 자료에서 전사하여 추가했습니다. 현재 ${questions.length}문항 반영(전사 진행 중, 정답 50문항 검증 완료).`,
      examRound: ROUND, examLevel: "SIMHWA",
      questionCount: total, addedCount: questions.length,
    },
  });

  console.log(`78회 반영: ${questions.length}문항 / 총 ${total}문항`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
