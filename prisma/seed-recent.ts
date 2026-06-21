import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

// 최근 회차(70~76회) 반영 — 출제 경향 조사 기반 오리지널 연습문항(원문 복제 아님).
// 2024: 70·71·72회 / 2025: 73·74·75·76회(심화 중심).
type Q = {
  level: "SIMHWA" | "GIBON"; examRound: number; era: string; qType: string;
  topics: string[]; difficulty: number; answerIndex: number;
  stem: string; passage?: string; explanation: string; choices: string[];
};

const yearOf: Record<number, number> = { 70: 2024, 71: 2024, 72: 2024, 73: 2025, 74: 2025, 75: 2025, 76: 2025 };
const ROUNDS = [70, 71, 72, 73, 74, 75, 76];

const questions: Q[] = [
  // 70회 (2024)
  { level: "SIMHWA", examRound: 70, era: "samguk", qType: "자료제시형", topics: ["무령왕", "백제", "22담로"], difficulty: 3, answerIndex: 1,
    passage: "벽돌(전돌)로 쌓은 무덤으로 중국 남조의 영향을 받았으며, 묘지석이 함께 출토되었다.",
    stem: "이 무덤에 묻힌 왕의 업적으로 옳은 것은?",
    explanation: "벽돌무덤·묘지석은 백제 무령왕릉의 특징이다. 무령왕은 지방에 22담로를 두고 왕족을 파견해 통제를 강화하였다.",
    choices: ["태학을 설립하였다.", "지방 22담로에 왕족을 파견하였다.", "녹읍을 폐지하였다.", "천리장성을 쌓았다.", "독서삼품과를 시행하였다."] },
  { level: "SIMHWA", examRound: 70, era: "goryeo", qType: "자료제시형", topics: ["최충헌", "도방", "교정도감"], difficulty: 3, answerIndex: 1,
    passage: "이의민을 제거하고 권력을 잡았으며, 봉사 10조를 올리고 교정도감을 통해 국정을 장악하였다.",
    stem: "밑줄 그은 인물에 대한 설명으로 옳은 것은?",
    explanation: "최충헌은 교정도감으로 국정을 총괄하고 사병 조직인 도방을 확대해 신변을 경호하였다.",
    choices: ["과거제를 처음 시행하였다.", "사병 조직인 도방을 확대하였다.", "쌍성총관부를 수복하였다.", "훈요 10조를 남겼다.", "9주 5소경을 정비하였다."] },
  { level: "GIBON", examRound: 70, era: "contemporary", qType: "개념형", topics: ["새마을 운동", "박정희"], difficulty: 2, answerIndex: 0,
    stem: "1970년대 정부가 근면·자조·협동을 내세워 추진한 농촌 근대화 운동으로 옳은 것은?",
    explanation: "새마을 운동은 1970년대 농촌 환경 개선과 소득 증대를 목표로 추진된 운동이다.",
    choices: ["새마을 운동", "물산 장려 운동", "국채 보상 운동", "브나로드 운동", "형평 운동"] },

  // 71회 (2024)
  { level: "GIBON", examRound: 71, era: "prehistoric", qType: "지도형", topics: ["청동기", "고인돌", "비파형 동검"], difficulty: 2, answerIndex: 2,
    stem: "(가) 시대를 대표하는 유물로 옳은 것은? — 계급이 발생하고 군장이 등장하였으며 고인돌을 만들었다.",
    explanation: "고인돌·계급 발생은 청동기 시대의 특징이며, 대표 유물로 비파형 동검과 반달 돌칼이 있다.",
    choices: ["주먹도끼", "빗살무늬 토기", "비파형 동검", "상평통보", "앙부일구"] },
  { level: "SIMHWA", examRound: 71, era: "joseon", qType: "인물형", topics: ["세조", "직전법", "계유정난"], difficulty: 3, answerIndex: 1,
    stem: "다음 정책을 추진한 왕에 대한 설명으로 옳은 것은? — 계유정난으로 권력을 잡고 6조 직계제를 부활시켰다.",
    explanation: "세조는 6조 직계제를 부활시키고 현직 관리에게만 수조권을 주는 직전법을 시행하였다.",
    choices: ["집현전을 설치하였다.", "현직 관리에게만 수조권을 주는 직전법을 시행하였다.", "훈민정음을 창제하였다.", "탕평책을 실시하였다.", "균역법을 시행하였다."] },
  { level: "SIMHWA", examRound: 71, era: "modern", qType: "개념형", topics: ["갑오개혁", "군국기무처", "신분제 폐지"], difficulty: 3, answerIndex: 1,
    stem: "군국기무처를 중심으로 추진된 개혁의 내용으로 옳은 것은?",
    explanation: "갑오개혁(1894)에서는 군국기무처를 중심으로 신분제와 과거제 폐지, 도량형 통일 등이 단행되었다.",
    choices: ["과거제를 도입하였다.", "신분제와 과거제를 폐지하였다.", "전국에 척화비를 세웠다.", "대한국 국제를 반포하였다.", "통리기무아문을 설치하였다."] },

  // 72회 (2024-10-20)
  { level: "SIMHWA", examRound: 72, era: "samguk", qType: "인물형", topics: ["진흥왕", "신라", "순수비", "대가야"], difficulty: 3, answerIndex: 2,
    stem: "다음 비석을 세운 신라 왕의 업적으로 옳은 것은? — 한강 유역을 차지하고 북한산 순수비를 세웠다.",
    explanation: "진흥왕은 한강 유역을 장악하고 순수비를 세웠으며, 화랑도를 국가 조직으로 정비하고 대가야를 병합하였다.",
    choices: ["우산국을 정복하였다.", "율령을 처음 반포하였다.", "대가야를 병합하였다.", "독서삼품과를 시행하였다.", "사비로 천도하였다."] },
  { level: "SIMHWA", examRound: 72, era: "japanese", qType: "자료제시형", topics: ["물산 장려 운동", "조만식"], difficulty: 3, answerIndex: 1,
    passage: "조만식 등이 평양에서 시작하여 '내 살림 내 것으로'를 내세웠다.",
    stem: "위 운동에 대한 설명으로 옳은 것은?",
    explanation: "물산 장려 운동은 국산품 애용을 통해 민족 산업을 보호·육성하려 한 경제적 민족 운동이다.",
    choices: ["국채 보상을 목표로 하였다.", "국산품 애용으로 민족 산업을 보호하려 하였다.", "독립문을 건립하였다.", "고종 강제 퇴위에 반대하였다.", "6·10 만세 운동을 주도하였다."] },
  { level: "GIBON", examRound: 72, era: "contemporary", qType: "개념형", topics: ["경제 개발 5개년 계획", "산업화"], difficulty: 2, answerIndex: 0,
    stem: "1960~70년대 정부 주도로 추진된 경제 정책에 대한 설명으로 옳은 것은?",
    explanation: "정부는 경제 개발 5개년 계획을 추진해 수출 중심의 산업화를 이끌었다.",
    choices: ["경제 개발 5개년 계획을 추진하였다.", "대동법을 시행하였다.", "산미 증식 계획을 폈다.", "화폐 정리 사업을 하였다.", "교정도감을 두었다."] },

  // 73회 (2025, 심화)
  { level: "SIMHWA", examRound: 73, era: "nambukguk", qType: "인물형", topics: ["발해", "선왕", "해동성국"], difficulty: 5, answerIndex: 2,
    stem: "다음 설명에 해당하는 발해 왕의 업적으로 옳은 것은? — 전성기를 이루어 중국으로부터 해동성국이라 불렸다.",
    explanation: "선왕 때 발해는 전성기를 맞아 5경 15부 62주의 지방 행정 제도를 정비하였고 해동성국이라 불렸다.",
    choices: ["인안 연호를 사용하였다.", "상경으로 처음 천도하였다.", "5경 15부 62주를 정비하였다.", "청해진을 설치하였다.", "독서삼품과를 시행하였다."] },
  { level: "SIMHWA", examRound: 73, era: "goryeo", qType: "자료제시형", topics: ["묘청", "서경 천도", "김부식"], difficulty: 4, answerIndex: 1,
    passage: "묘청 등이 서경 천도와 칭제 건원, 금국 정벌을 주장하며 난을 일으켰다.",
    stem: "위 사건에 대한 설명으로 옳은 것은?",
    explanation: "묘청의 서경 천도 운동(1135)은 김부식이 이끄는 관군에 의해 진압되었다.",
    choices: ["무신정변의 직접 원인이 되었다.", "김부식의 관군에 진압되었다.", "교정도감 설치로 이어졌다.", "강동 6주를 획득하였다.", "위화도 회군으로 끝났다."] },
  { level: "SIMHWA", examRound: 73, era: "joseon", qType: "개념형", topics: ["광해군", "중립 외교"], difficulty: 3, answerIndex: 1,
    stem: "광해군 시기에 있었던 사실로 옳은 것은?",
    explanation: "광해군은 명과 후금 사이에서 실리적 중립 외교를 폈고, 대동법을 경기도에서 처음 시행하였다.",
    choices: ["6조 직계제를 처음 두었다.", "명과 후금 사이에서 중립 외교를 추진하였다.", "탕평비를 세웠다.", "규장각을 설치하였다.", "4군 6진을 개척하였다."] },

  // 74회 (2025, 심화)
  { level: "SIMHWA", examRound: 74, era: "samguk", qType: "인물형", topics: ["금관가야", "김수로", "철"], difficulty: 3, answerIndex: 1,
    stem: "(가) 나라에 대한 설명으로 옳은 것은? — 김수로왕이 김해 지역에 세웠으며 철이 풍부하였다.",
    explanation: "금관가야는 김해의 풍부한 철을 바탕으로 낙랑과 왜에 철을 수출하며 해상 교역으로 번성하였다.",
    choices: ["골품제가 있었다.", "낙랑과 왜에 철을 수출하였다.", "영고를 열었다.", "웅진으로 천도하였다.", "9주 5소경을 두었다."] },
  { level: "SIMHWA", examRound: 74, era: "modern", qType: "개념형", topics: ["대한제국", "광무개혁", "지계"], difficulty: 4, answerIndex: 1,
    stem: "대한제국이 추진한 광무개혁의 내용으로 옳은 것은?",
    explanation: "광무개혁은 구본신참을 원칙으로 양전 사업을 벌이고 토지 소유 문서인 지계를 발급하였다.",
    choices: ["과거제를 도입하였다.", "양전 사업을 벌이고 지계를 발급하였다.", "신분제를 폐지하였다.", "척화비를 세웠다.", "교정도감을 두었다."] },
  { level: "SIMHWA", examRound: 74, era: "japanese", qType: "자료제시형", topics: ["한국광복군", "임시정부", "지청천"], difficulty: 4, answerIndex: 2,
    passage: "대한민국 임시정부가 충칭에서 창설한 정규 군대로, 총사령관은 지청천이었다.",
    stem: "위 부대에 대한 설명으로 옳은 것은?",
    explanation: "한국광복군(1940)은 미국 OSS와 협력하여 국내 진공 작전을 준비하였다.",
    choices: ["봉오동 전투를 이끌었다.", "청산리에서 승리하였다.", "미군과 협력해 국내 진공 작전을 계획하였다.", "6·10 만세 운동을 주도하였다.", "교정도감을 설치하였다."] },

  // 75회 (2025, 심화)
  { level: "SIMHWA", examRound: 75, era: "goryeo", qType: "자료제시형", topics: ["삼별초", "배중손", "대몽 항쟁"], difficulty: 4, answerIndex: 1,
    passage: "개경 환도에 반발하여 강화도에서 진도·제주도로 근거지를 옮기며 항쟁을 이어갔다.",
    stem: "밑줄 그은 군대에 대한 설명으로 옳은 것은?",
    explanation: "삼별초는 개경 환도에 반발해 배중손 등의 지휘로 진도·제주도로 옮겨 가며 대몽 항쟁을 전개하였다.",
    choices: ["별무반에서 비롯되었다.", "배중손 등이 지휘하여 대몽 항쟁을 폈다.", "귀주에서 거란을 물리쳤다.", "위화도에서 회군하였다.", "교정도감을 설치하였다."] },
  { level: "SIMHWA", examRound: 75, era: "joseon", qType: "인물형", topics: ["권율", "행주 대첩", "임진왜란"], difficulty: 2, answerIndex: 0,
    stem: "다음 전투를 승리로 이끈 인물로 옳은 것은? — 임진왜란 때 행주산성에서 왜군을 크게 무찔렀다.",
    explanation: "행주 대첩(1593)을 이끈 인물은 권율이다. (진주 대첩은 김시민, 한산도 대첩은 이순신)",
    choices: ["권율", "곽재우", "김시민", "이순신", "조헌"] },
  { level: "SIMHWA", examRound: 75, era: "contemporary", qType: "개념형", topics: ["농지 개혁", "유상 매수"], difficulty: 4, answerIndex: 1,
    stem: "1949년 제정·시행된 농지 개혁법에 대한 설명으로 옳은 것은?",
    explanation: "남한의 농지 개혁은 유상 매수·유상 분배 원칙으로 시행되어 지주제를 해체하고 자영농을 늘렸다.",
    choices: ["무상 몰수·무상 분배 방식이었다.", "유상 매수·유상 분배 원칙이었다.", "토지 조사 사업의 일환이었다.", "대동법과 함께 시행되었다.", "과전법으로 불렸다."] },

  // 76회 (2025, 심화)
  { level: "SIMHWA", examRound: 76, era: "prehistoric", qType: "개념형", topics: ["구석기", "뗀석기"], difficulty: 2, answerIndex: 1,
    stem: "구석기 시대의 생활 모습으로 옳은 것은?",
    explanation: "구석기 시대 사람들은 뗀석기를 사용하고 사냥·채집을 하며 동굴이나 막집에서 이동 생활을 하였다.",
    choices: ["빗살무늬 토기를 사용하였다.", "뗀석기로 사냥하고 이동 생활을 하였다.", "고인돌을 만들었다.", "철제 농기구를 사용하였다.", "반달 돌칼로 추수하였다."] },
  { level: "SIMHWA", examRound: 76, era: "samguk", qType: "자료제시형", topics: ["을지문덕", "살수 대첩", "고구려"], difficulty: 3, answerIndex: 1,
    passage: "'그대의 신묘한 책략은 천문을 꿰뚫었고…'라는 시(여수장우중문시)를 지어 적장에게 보냈다.",
    stem: "위 시를 보낸 인물에 대한 설명으로 옳은 것은?",
    explanation: "여수장우중문시를 보낸 인물은 을지문덕으로, 살수에서 수의 대군을 크게 무찔렀다(살수 대첩).",
    choices: ["안시성에서 당군을 막았다.", "살수에서 수의 대군을 격파하였다.", "귀주에서 거란을 물리쳤다.", "한산도에서 왜군을 무찔렀다.", "쌍성총관부를 수복하였다."] },
  { level: "SIMHWA", examRound: 76, era: "modern", qType: "자료제시형", topics: ["임오군란", "구식 군인", "제물포 조약"], difficulty: 3, answerIndex: 1,
    passage: "구식 군인들이 별기군과의 차별과 밀린 급료에 반발하여 봉기하였다.",
    stem: "위 사건의 결과로 옳은 것은?",
    explanation: "임오군란(1882)은 청군의 개입으로 진압되었고, 일본과 제물포 조약을 체결하는 결과로 이어졌다.",
    choices: ["강화도 조약이 체결되었다.", "청군 개입과 제물포 조약 체결로 이어졌다.", "갑오개혁이 시작되었다.", "대한제국이 선포되었다.", "독립문이 건립되었다."] },
];

async function main() {
  // 멱등성: 70~76회 SEED 문항/릴리스 제거 후 재삽입 (60~69회·관리자 업로드 보존)
  await prisma.question.deleteMany({ where: { source: "SEED", examRound: { in: ROUNDS } } });
  await prisma.release.deleteMany({ where: { examRound: { in: ROUNDS } } });

  for (const q of questions) {
    await prisma.question.create({
      data: {
        level: q.level, examRound: q.examRound, examYear: yearOf[q.examRound] ?? null,
        stem: q.stem, passage: q.passage ?? null, explanation: q.explanation,
        answerIndex: q.answerIndex, era: q.era, topics: JSON.stringify(q.topics),
        qType: q.qType, difficulty: q.difficulty, source: "SEED",
        choices: { create: q.choices.map((text, order) => ({ text, order })) },
      },
    });
  }

  // 남은 릴리스의 최대 버전 이후로 70~76회 릴리스 추가
  const last = await prisma.release.findFirst({ orderBy: { version: "desc" } });
  let version = last?.version ?? 0;
  const base = await prisma.question.count({ where: { examRound: { notIn: ROUNDS } } });
  let cumulativeNew = 0;
  for (const round of ROUNDS) {
    version++;
    const added = questions.filter((q) => q.examRound === round).length;
    cumulativeNew += added;
    const simhwa = questions.filter((q) => q.examRound === round && q.level === "SIMHWA").length;
    const gibon = added - simhwa;
    const yr = yearOf[round];
    await prisma.release.create({
      data: {
        version,
        title: `${round}회(${yr}) 문항 반영`,
        notes: `${round}회 출제 경향 기반 ${added}문항 추가 (심화 ${simhwa} / 기본 ${gibon}). 최근 회차 트렌드를 반영한 오리지널 연습문항입니다.`,
        examRound: round, examLevel: "BOTH",
        questionCount: base + cumulativeNew, addedCount: added,
      },
    });
  }

  const qc = await prisma.question.count();
  const rc = await prisma.release.count();
  console.log(`최근 회차 반영 완료: 총 문항 ${qc}개, 릴리스 ${rc}건(60~76회)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
