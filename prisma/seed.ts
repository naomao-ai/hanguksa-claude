import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

type Q = {
  level: "SIMHWA" | "GIBON";
  examRound: number;
  era: string;
  qType: string;
  topics: string[];
  difficulty: number;
  answerIndex: number;
  stem: string;
  passage?: string;
  explanation: string;
  choices: string[];
};

const yearOf: Record<number, number> = {
  60: 2022, 61: 2022, 62: 2022, 63: 2023, 64: 2023,
  65: 2023, 66: 2023, 67: 2024, 68: 2024, 69: 2024,
};

// 최근 10회차(60~69회) 형식에 맞춘 자체 제작 연습문항.
// (저작권상 실제 기출 원문 복제가 아닌, 출제 형식·난이도를 모사한 오리지널 문항)
const questions: Q[] = [
  // ── 선사·고조선·연맹왕국 ──
  { level: "GIBON", examRound: 69, era: "prehistoric", qType: "자료제시형", topics: ["신석기", "빗살무늬토기", "농경"], difficulty: 1, answerIndex: 1,
    passage: "이 시대 사람들은 강가나 바닷가에 움집을 짓고, 빗살무늬 토기에 식량을 저장하였다.",
    stem: "(가) 시대의 생활 모습으로 옳은 것은?",
    explanation: "빗살무늬 토기·움집·농경 시작은 신석기 시대의 특징이다. 가락바퀴로 실을 뽑아 옷을 지었다.",
    choices: ["철제 농기구로 농사를 지었다.", "가락바퀴로 실을 뽑아 옷을 만들었다.", "주로 동굴에서 거주하였다.", "거푸집으로 청동기를 제작하였다.", "고인돌을 만들었다."] },
  { level: "SIMHWA", examRound: 68, era: "gojoseon", qType: "자료제시형", topics: ["고조선", "8조법", "단군"], difficulty: 2, answerIndex: 4,
    passage: "사람을 죽인 자는 즉시 사형에 처하고, 남에게 상해를 입힌 자는 곡식으로 갚게 하였다.",
    stem: "위 법을 시행한 나라에 대한 설명으로 옳은 것은?",
    explanation: "8조법(범금 8조)은 고조선의 사회상을 보여준다. 단군왕검이 건국하였고 위만 집권 후 철기 문화가 발전하였다.",
    choices: ["영고라는 제천 행사를 열었다.", "민며느리제의 풍습이 있었다.", "소도라는 신성 지역이 있었다.", "골품제로 신분을 구분하였다.", "단군왕검이 건국하였다고 전해진다."] },
  { level: "SIMHWA", examRound: 64, era: "gojoseon", qType: "인물형", topics: ["부여", "영고", "사출도"], difficulty: 2, answerIndex: 2,
    passage: "12월에 하늘에 제사를 지내며 며칠을 먹고 마시니 이를 영고라 한다.",
    stem: "(가) 나라에 대한 설명으로 옳은 것은?",
    explanation: "영고는 부여의 제천 행사다. 부여는 마가·우가·저가·구가가 사출도를 다스렸다.",
    choices: ["민며느리제가 있었다.", "무천이라는 제천 행사를 열었다.", "여러 가(加)들이 사출도를 다스렸다.", "범금 8조가 있었다.", "골품제가 있었다."] },
  { level: "GIBON", examRound: 61, era: "gojoseon", qType: "개념형", topics: ["동예", "책화", "무천"], difficulty: 1, answerIndex: 0,
    stem: "다음 설명에 해당하는 나라는? — 무천이라는 제천 행사를 열었고, 다른 부족의 영역을 침범하면 책화로 배상하였다.",
    explanation: "무천·책화·단궁·과하마·반어피는 동예의 특징이다.",
    choices: ["동예", "부여", "고구려", "삼한", "옥저"] },

  // ── 삼국 ──
  { level: "SIMHWA", examRound: 69, era: "samguk", qType: "인물형", topics: ["광개토 대왕", "장수왕", "고구려"], difficulty: 2, answerIndex: 3,
    passage: "영락이라는 연호를 사용하고, 백제를 공격하여 한강 이북을 차지하였다.",
    stem: "밑줄 그은 왕의 활동으로 옳은 것은?",
    explanation: "영락 연호는 고구려 광개토 대왕의 것이다. 신라에 침입한 왜를 격퇴하여 한반도 남부까지 영향력을 미쳤다.",
    choices: ["평양으로 천도하였다.", "낙랑군을 축출하였다.", "태학을 설립하였다.", "신라에 침입한 왜를 격퇴하였다.", "천리장성을 쌓았다."] },
  { level: "SIMHWA", examRound: 67, era: "samguk", qType: "인물형", topics: ["근초고왕", "백제"], difficulty: 3, answerIndex: 1,
    stem: "다음 업적을 남긴 백제 왕의 활동으로 옳은 것은? — 마한을 정복하고 고구려를 공격해 고국원왕을 전사시켰다.",
    explanation: "근초고왕은 마한을 정복하고 평양성을 공격해 고국원왕을 전사시켰으며, 왜에 칠지도를 하사한 것으로 전한다.",
    choices: ["사비로 천도하였다.", "왜에 칠지도를 보냈다.", "22담로를 설치하였다.", "불교를 공인하였다.", "나당 연합을 결성하였다."] },
  { level: "SIMHWA", examRound: 63, era: "samguk", qType: "인물형", topics: ["법흥왕", "신라", "불교 공인"], difficulty: 2, answerIndex: 2,
    stem: "다음 정책을 시행한 신라 왕의 업적으로 옳은 것은? — 율령을 반포하고 병부를 설치하였다.",
    explanation: "법흥왕은 율령 반포·병부 설치·불교 공인·금관가야 병합·'건원' 연호를 사용하였다.",
    choices: ["우산국을 정복하였다.", "화랑도를 국가 조직으로 개편하였다.", "이차돈의 순교로 불교를 공인하였다.", "대가야를 병합하였다.", "북한산 순수비를 세웠다."] },
  { level: "GIBON", examRound: 60, era: "samguk", qType: "지도형", topics: ["신라", "불국사", "석굴암"], difficulty: 1, answerIndex: 0,
    stem: "경주에 위치한 (가) 나라의 대표 문화유산으로 옳은 것은?",
    explanation: "금성(경주)을 도읍으로 한 신라는 불국사·석굴암 등 불교 문화유산을 남겼다.",
    choices: ["석굴암 본존불", "금동 대향로", "무령왕릉", "광개토 대왕릉비", "정림사지 5층 석탑"] },

  // ── 남북국 ──
  { level: "SIMHWA", examRound: 68, era: "nambukguk", qType: "인물형", topics: ["신문왕", "통일신라", "녹읍"], difficulty: 3, answerIndex: 1,
    stem: "다음 정책을 추진한 왕의 업적으로 옳은 것은? — 김흠돌의 난을 진압하고 9주 5소경을 정비하였다.",
    explanation: "신문왕은 9주 5소경 정비, 국학 설립, 관료전 지급과 녹읍 폐지로 왕권을 강화하였다.",
    choices: ["독서삼품과를 시행하였다.", "관료전을 지급하고 녹읍을 폐지하였다.", "청해진을 설치하였다.", "발해를 건국하였다.", "쌍성총관부를 수복하였다."] },
  { level: "SIMHWA", examRound: 65, era: "nambukguk", qType: "자료제시형", topics: ["발해", "무왕", "문왕"], difficulty: 3, answerIndex: 4,
    passage: "대흥이라는 연호를 사용하고 수도를 상경 용천부로 옮겼으며, 신라도를 통해 신라와 교류하였다.",
    stem: "밑줄 그은 왕에 대한 설명으로 옳은 것은?",
    explanation: "'대흥' 연호·상경 천도·신라도는 발해 문왕의 사실이다. 당의 제도를 받아들여 3성 6부를 정비하였다.",
    choices: ["인안 연호를 사용하였다.", "산둥반도를 공격하였다.", "해동성국이라 불렸다.", "동모산에서 건국하였다.", "당의 제도를 본떠 통치 체제를 정비하였다."] },

  // ── 고려 ──
  { level: "SIMHWA", examRound: 69, era: "goryeo", qType: "인물형", topics: ["광종", "과거제", "노비안검법"], difficulty: 2, answerIndex: 0,
    passage: "노비를 조사하여 본래 양인이었던 자를 해방하고, 광덕·준풍 등 독자적 연호를 사용하였다.",
    stem: "다음 정책을 실시한 왕의 업적으로 옳은 것은?",
    explanation: "노비안검법·독자 연호는 고려 광종의 정책이다. 쌍기의 건의로 과거제를 처음 시행하였다.",
    choices: ["과거제를 처음 시행하였다.", "전시과를 마련하였다.", "훈요 10조를 남겼다.", "12목에 지방관을 파견하였다.", "삼국사기를 편찬하게 하였다."] },
  { level: "SIMHWA", examRound: 66, era: "goryeo", qType: "인물형", topics: ["공민왕", "전민변정도감", "쌍성총관부"], difficulty: 3, answerIndex: 3,
    stem: "다음 정책을 추진한 왕의 활동으로 옳은 것은? — 신돈을 등용하고 정동행성 이문소를 폐지하였다.",
    explanation: "공민왕은 신돈을 통한 전민변정도감 운영, 정동행성 이문소 폐지, 쌍성총관부 수복 등 반원 자주 정책을 폈다.",
    choices: ["과거제를 처음 도입하였다.", "강동 6주를 획득하였다.", "별무반을 편성하였다.", "쌍성총관부를 수복하였다.", "훈민정음을 창제하였다."] },
  { level: "SIMHWA", examRound: 64, era: "goryeo", qType: "순서나열형", topics: ["서희", "강감찬", "거란"], difficulty: 3, answerIndex: 2,
    stem: "거란의 침입과 관련된 사실로 옳은 것은?",
    explanation: "서희는 외교 담판으로 강동 6주를 확보했고, 강감찬은 귀주에서 거란군을 크게 무찔렀다(귀주 대첩).",
    choices: ["윤관이 동북 9성을 쌓았다.", "삼별초가 항쟁하였다.", "강감찬이 귀주에서 크게 승리하였다.", "최무선이 화포로 왜구를 격퇴하였다.", "이성계가 위화도에서 회군하였다."] },
  { level: "GIBON", examRound: 62, era: "goryeo", qType: "지도형", topics: ["직지심체요절", "금속활자", "청주"], difficulty: 2, answerIndex: 1,
    stem: "현존하는 세계에서 가장 오래된 금속 활자본으로 옳은 것은?",
    explanation: "청주 흥덕사에서 간행된 직지심체요절은 현존 최고(最古)의 금속 활자본으로 프랑스 국립도서관에 소장되어 있다.",
    choices: ["팔만대장경", "직지심체요절", "무구정광대다라니경", "삼국유사", "조선왕조실록"] },
  { level: "SIMHWA", examRound: 61, era: "goryeo", qType: "개념형", topics: ["성종", "최승로", "시무 28조"], difficulty: 3, answerIndex: 0,
    stem: "최승로의 건의를 받아들인 왕의 정책으로 옳은 것은?",
    explanation: "성종은 최승로의 시무 28조를 수용해 12목에 지방관을 파견하고 유교 정치 이념을 채택, 국자감을 정비하였다.",
    choices: ["12목에 지방관을 파견하였다.", "노비안검법을 실시하였다.", "전시과를 폐지하였다.", "사심관 제도를 처음 두었다.", "쌍성총관부를 수복하였다."] },

  // ── 조선 ──
  { level: "SIMHWA", examRound: 69, era: "joseon", qType: "인물형", topics: ["세종", "훈민정음", "집현전"], difficulty: 2, answerIndex: 4,
    stem: "다음 업적과 관련된 왕의 정책으로 옳은 것은? — 집현전을 설치하고 측우기를 제작하게 하였다.",
    explanation: "세종은 집현전 설치·훈민정음 창제·측우기 제작·4군 6진 개척·쓰시마 정벌(이종무)을 추진하였다.",
    choices: ["경국대전을 완성하였다.", "탕평비를 세웠다.", "규장각을 설치하였다.", "대전회통을 편찬하였다.", "4군 6진을 개척하였다."] },
  { level: "SIMHWA", examRound: 68, era: "joseon", qType: "인물형", topics: ["영조", "탕평책", "균역법"], difficulty: 3, answerIndex: 1,
    stem: "다음 정책을 추진한 왕의 업적으로 옳은 것은? — 붕당의 폐단을 막고자 탕평비를 건립하였다.",
    explanation: "영조는 탕평책·균역법·신문고 부활·속대전 편찬을 추진하였다.",
    choices: ["규장각을 설치하였다.", "균역법을 시행하였다.", "수원 화성을 건설하였다.", "대동법을 처음 실시하였다.", "훈민정음을 반포하였다."] },
  { level: "SIMHWA", examRound: 67, era: "joseon", qType: "인물형", topics: ["정조", "규장각", "수원 화성"], difficulty: 3, answerIndex: 2,
    stem: "다음 정책을 시행한 왕에 대한 설명으로 옳은 것은? — 친위 부대인 장용영을 설치하였다.",
    explanation: "정조는 규장각·장용영·수원 화성·초계문신제·신해통공을 추진하였다.",
    choices: ["균역법을 시행하였다.", "6조 직계제를 처음 실시하였다.", "수원 화성을 건설하였다.", "훈민정음을 창제하였다.", "비변사를 폐지하였다."] },
  { level: "SIMHWA", examRound: 66, era: "joseon", qType: "자료제시형", topics: ["대동법", "공인", "광해군"], difficulty: 3, answerIndex: 3,
    passage: "집집마다 부과하던 공물을 토지 결수에 따라 쌀·베·동전으로 납부하게 하였다.",
    stem: "위 제도에 대한 설명으로 옳은 것은?",
    explanation: "대동법은 광해군 때 경기도에서 처음 실시되었고, 관청에 물품을 조달하는 공인이 등장하는 계기가 되었다.",
    choices: ["양반에게도 군포를 징수하였다.", "전세를 풍흉에 따라 차등 부과하였다.", "호구를 조사해 호패를 발급하였다.", "공인이 등장하는 배경이 되었다.", "양전 사업과 무관하였다."] },
  { level: "GIBON", examRound: 65, era: "joseon", qType: "인물형", topics: ["이순신", "명량 해전", "임진왜란"], difficulty: 1, answerIndex: 4,
    stem: "다음 인물에 대한 설명으로 옳은 것은? — 명량에서 13척으로 왜군을 물리쳤다.",
    explanation: "이순신은 한산도 대첩에서 학익진을, 명량 대첩에서 13척으로 대승을 거두었다.",
    choices: ["4군 6진을 개척하였다.", "동의보감을 저술하였다.", "균역법을 시행하였다.", "대동여지도를 제작하였다.", "한산도 대첩에서 학익진을 펼쳤다."] },
  { level: "SIMHWA", examRound: 63, era: "joseon", qType: "개념형", topics: ["실학", "정약용", "박지원"], difficulty: 3, answerIndex: 0,
    stem: "조선 후기 실학에 대한 설명으로 옳은 것은?",
    explanation: "정약용 등 중농학파는 토지 제도 개혁을, 박지원·박제가 등 중상학파(북학파)는 상공업 진흥과 청 문물 수용을 주장하였다.",
    choices: ["박지원은 수레와 선박의 이용을 강조하였다.", "정약용은 화폐 사용을 반대하였다.", "이익은 상공업 중심 개혁을 주장하였다.", "유형원은 북학을 주장하였다.", "성리학을 집대성하였다."] },

  // ── 근대(개항기) ──
  { level: "SIMHWA", examRound: 69, era: "modern", qType: "인물형", topics: ["흥선대원군", "경복궁", "척화비"], difficulty: 2, answerIndex: 1,
    stem: "다음 정책을 추진한 인물에 대한 설명으로 옳은 것은? — 비변사를 축소하고 경복궁을 중건하였다.",
    explanation: "흥선대원군은 서원 철폐, 호포제 실시, 경복궁 중건, 척화비 건립 등을 추진하였다.",
    choices: ["갑신정변을 일으켰다.", "전국에 척화비를 세웠다.", "독립협회를 창립하였다.", "강화도 조약을 체결하였다.", "대한제국을 선포하였다."] },
  { level: "SIMHWA", examRound: 68, era: "modern", qType: "순서나열형", topics: ["강화도 조약", "개항", "통리기무아문"], difficulty: 3, answerIndex: 3,
    stem: "강화도 조약 체결 직후의 사실로 옳은 것은?",
    explanation: "강화도 조약(1876) 이후 정부는 개화 정책을 총괄하는 통리기무아문을 설치하였다.",
    choices: ["대한국 국제가 반포되었다.", "을사늑약이 체결되었다.", "헌의 6조가 결의되었다.", "통리기무아문이 설치되었다.", "국채 보상 운동이 일어났다."] },
  { level: "SIMHWA", examRound: 66, era: "modern", qType: "자료제시형", topics: ["갑신정변", "김옥균", "우정총국"], difficulty: 3, answerIndex: 2,
    passage: "우정총국 개국 축하연을 기회로 급진 개화파가 정변을 일으켜 14개조 정강을 발표하였다.",
    stem: "위 사건에 대한 설명으로 옳은 것은?",
    explanation: "갑신정변(1884)은 김옥균 등 급진 개화파가 일으켰으나 청군 개입으로 3일 만에 실패하였다.",
    choices: ["전주 화약이 체결되었다.", "집강소가 설치되었다.", "청군의 개입으로 3일 만에 실패하였다.", "단발령에 반발하여 일어났다.", "독립문 건립으로 이어졌다."] },
  { level: "SIMHWA", examRound: 62, era: "modern", qType: "순서나열형", topics: ["동학 농민 운동", "전봉준", "전주 화약"], difficulty: 3, answerIndex: 4,
    stem: "동학 농민 운동의 전개 과정에 대한 설명으로 옳은 것은?",
    explanation: "동학 농민군은 황토현 승리 후 전주성을 점령, 전주 화약을 맺고 집강소를 설치하였다. 이후 우금치에서 일본군에 패하였다.",
    choices: ["강화도 조약 체결의 계기가 되었다.", "을미사변에 반발하여 일어났다.", "대한제국 수립으로 이어졌다.", "교조 신원과 무관하였다.", "전주 화약 후 집강소가 설치되었다."] },
  { level: "GIBON", examRound: 61, era: "modern", qType: "개념형", topics: ["을사늑약", "외교권", "통감부"], difficulty: 2, answerIndex: 0,
    stem: "1905년에 체결된 조약의 결과로 옳은 것은?",
    explanation: "을사늑약(1905)으로 대한제국은 외교권을 박탈당하고 통감부가 설치되었다.",
    choices: ["외교권을 박탈당하였다.", "군대가 강제 해산되었다.", "토지 조사 사업이 시작되었다.", "회사령이 공포되었다.", "관세 자주권을 회복하였다."] },

  // ── 일제 강점기 ──
  { level: "SIMHWA", examRound: 69, era: "japanese", qType: "자료제시형", topics: ["신민회", "안창호", "오산학교"], difficulty: 3, answerIndex: 2,
    passage: "안창호·양기탁 등이 비밀 결사로 조직하여 국권 회복과 공화정체의 국민 국가 수립을 목표로 하였다.",
    stem: "위 단체의 활동으로 옳은 것은?",
    explanation: "신민회(1907)는 대성학교·오산학교를 세우고 태극서관·자기 회사를 운영하였다.",
    choices: ["만민 공동회를 개최하였다.", "독립문을 건립하였다.", "대성학교와 오산학교를 설립하였다.", "물산 장려 운동을 주도하였다.", "헌의 6조를 결의하였다."] },
  { level: "SIMHWA", examRound: 67, era: "japanese", qType: "인물형", topics: ["의열단", "김원봉", "신채호"], difficulty: 3, answerIndex: 1,
    passage: "김원봉이 조직하였으며, 신채호의 조선 혁명 선언을 활동 지침으로 삼았다.",
    stem: "(가) 단체의 활동으로 옳은 것은?",
    explanation: "의열단은 신채호의 '조선 혁명 선언'을 지침으로 김상옥·나석주 등이 의열 투쟁을 전개하였다.",
    choices: ["봉오동 전투를 이끌었다.", "김상옥·나석주 등이 의거를 일으켰다.", "한국광복군을 창설하였다.", "물산 장려 운동을 전개하였다.", "독립문을 건립하였다."] },
  { level: "SIMHWA", examRound: 65, era: "japanese", qType: "인물형", topics: ["김구", "한인애국단", "윤봉길"], difficulty: 2, answerIndex: 3,
    stem: "다음 단체에 대한 설명으로 옳은 것은? — 김구가 조직하였으며 이봉창·윤봉길이 소속되어 있었다.",
    explanation: "한인 애국단(김구)은 이봉창의 일왕 폭탄 투척, 윤봉길의 상하이 훙커우 공원 의거를 일으켰다.",
    choices: ["봉오동에서 일본군을 격파하였다.", "청산리에서 대승을 거두었다.", "신간회를 결성하였다.", "윤봉길이 훙커우 공원에서 의거하였다.", "형평 운동을 전개하였다."] },
  { level: "SIMHWA", examRound: 63, era: "japanese", qType: "순서나열형", topics: ["봉오동 전투", "청산리 대첩", "홍범도", "김좌진"], difficulty: 3, answerIndex: 0,
    stem: "1920년 만주에서 전개된 무장 독립 전쟁에 대한 설명으로 옳은 것은?",
    explanation: "홍범도의 대한 독립군이 봉오동에서, 김좌진의 북로 군정서 등이 청산리에서 일본군에 대승을 거두었다.",
    choices: ["김좌진이 청산리에서 크게 승리하였다.", "한국광복군이 국내 진공 작전을 폈다.", "윤봉길이 의거를 일으켰다.", "물산 장려 운동이 시작되었다.", "광주 학생 항일 운동이 일어났다."] },
  { level: "GIBON", examRound: 60, era: "japanese", qType: "개념형", topics: ["3·1 운동", "임시정부"], difficulty: 1, answerIndex: 2,
    stem: "1919년에 일어난 전국적 만세 시위에 대한 설명으로 옳은 것은?",
    explanation: "3·1 운동(1919)은 전국·국외로 확산되었고, 대한민국 임시정부 수립의 계기가 되었다.",
    choices: ["갑오개혁을 이끌어냈다.", "을사늑약에 반발하였다.", "대한민국 임시정부 수립의 계기가 되었다.", "강화도 조약으로 이어졌다.", "신간회가 주도하였다."] },

  // ── 현대 ──
  { level: "SIMHWA", examRound: 68, era: "contemporary", qType: "순서나열형", topics: ["4·19 혁명", "이승만", "3·15 부정선거"], difficulty: 2, answerIndex: 1,
    stem: "다음 민주화 운동에 대한 설명으로 옳은 것은? — 3·15 부정 선거에 반발하여 일어났다.",
    explanation: "4·19 혁명(1960)은 3·15 부정 선거에 항거하여 일어났고, 이승만 대통령이 하야하였다.",
    choices: ["6·29 선언을 이끌어냈다.", "이승만 대통령이 하야하였다.", "신군부 퇴진을 요구하였다.", "유신 체제에 반대하였다.", "5·18 민주화 운동으로 불린다."] },
  { level: "SIMHWA", examRound: 66, era: "contemporary", qType: "개념형", topics: ["6월 민주항쟁", "6·29 선언", "직선제"], difficulty: 2, answerIndex: 4,
    stem: "1987년에 일어난 민주화 운동의 결과로 옳은 것은?",
    explanation: "6월 민주 항쟁(1987)의 결과 6·29 선언이 발표되어 대통령 직선제 개헌이 이루어졌다.",
    choices: ["유신 헌법이 제정되었다.", "5·16 군사 정변이 일어났다.", "이승만이 하야하였다.", "한일 협정이 체결되었다.", "대통령 직선제 개헌이 이루어졌다."] },
  { level: "GIBON", examRound: 64, era: "contemporary", qType: "개념형", topics: ["5·18 민주화운동", "신군부", "광주"], difficulty: 2, answerIndex: 1,
    stem: "(가) 민주화 운동에 대한 설명으로 옳은 것은? — 1980년 광주에서 신군부에 맞서 일어났다.",
    explanation: "1980년 광주에서 신군부의 계엄 확대에 맞서 일어난 5·18 민주화 운동이다.",
    choices: ["4·19 혁명으로 이승만이 하야하였다.", "신군부 퇴진과 계엄 철폐를 요구하였다.", "6·29 선언을 이끌어냈다.", "유신 체제에 반대하였다.", "3·15 부정 선거가 배경이었다."] },
  { level: "SIMHWA", examRound: 62, era: "contemporary", qType: "순서나열형", topics: ["7·4 남북 공동 성명", "6·15 공동선언", "통일"], difficulty: 3, answerIndex: 0,
    stem: "남북 관계에 대한 설명으로 옳은 것은?",
    explanation: "7·4 남북 공동 성명(1972)은 자주·평화·민족 대단결의 통일 원칙에 합의하였고, 6·15 남북 공동 선언(2000)으로 이어졌다.",
    choices: ["7·4 남북 공동 성명에서 통일 원칙에 합의하였다.", "6·15 선언으로 남북이 분단되었다.", "남북 기본 합의서는 1948년에 채택되었다.", "개성 공단은 1970년대에 건설되었다.", "이산가족 상봉은 한 번도 없었다."] },
  { level: "GIBON", examRound: 61, era: "contemporary", qType: "개념형", topics: ["6·25 전쟁", "정전협정"], difficulty: 2, answerIndex: 3,
    stem: "1950년에 일어난 전쟁에 대한 설명으로 옳은 것은?",
    explanation: "6·25 전쟁은 북한의 남침으로 시작되어 인천 상륙 작전, 중국군 개입을 거쳐 1953년 정전 협정으로 멈췄다.",
    choices: ["갑신정변의 결과로 일어났다.", "을미사변이 배경이 되었다.", "신간회가 주도하였다.", "정전 협정으로 휴전되었다.", "4·19 혁명으로 끝났다."] },

  // ── 추가 보강 (회차 분산) ──
  { level: "GIBON", examRound: 67, era: "goryeo", qType: "개념형", topics: ["팔만대장경", "몽골", "강화도"], difficulty: 2, answerIndex: 2,
    stem: "다음 문화유산에 대한 설명으로 옳은 것은? — 몽골의 침입을 부처의 힘으로 물리치려는 염원을 담아 제작되었다.",
    explanation: "팔만대장경(재조대장경)은 몽골 침입기에 강화도에서 제작되었으며 현재 합천 해인사에 보관되어 있다.",
    choices: ["거란의 침입 때 제작되었다.", "직지심체요절이라 불린다.", "현재 해인사에 보관되어 있다.", "금속 활자로 인쇄되었다.", "일본에 의해 소실되었다."] },
  { level: "SIMHWA", examRound: 60, era: "joseon", qType: "자료제시형", topics: ["병자호란", "인조", "남한산성"], difficulty: 3, answerIndex: 1,
    passage: "왕이 남한산성에서 항전하였으나 결국 삼전도에서 청 태종에게 항복하였다.",
    stem: "위 사건에 대한 설명으로 옳은 것은?",
    explanation: "병자호란(1636) 때 인조는 남한산성에서 항전하다 삼전도에서 청에 항복하였다.",
    choices: ["이순신이 활약하였다.", "인조가 삼전도에서 항복하였다.", "강화도 조약으로 끝났다.", "권율이 행주에서 승리하였다.", "쓰시마 정벌로 이어졌다."] },
  { level: "GIBON", examRound: 64, era: "modern", qType: "개념형", topics: ["국채 보상 운동", "대구", "서상돈"], difficulty: 2, answerIndex: 0,
    stem: "1907년 대구에서 시작된 경제적 구국 운동으로 옳은 것은?",
    explanation: "국채 보상 운동(1907)은 대구에서 서상돈 등의 주도로 일어나 전국으로 확산되었다.",
    choices: ["국채 보상 운동", "물산 장려 운동", "형평 운동", "새마을 운동", "민립 대학 설립 운동"] },
  { level: "SIMHWA", examRound: 65, era: "japanese", qType: "개념형", topics: ["신간회", "1927", "민족 유일당"], difficulty: 3, answerIndex: 4,
    stem: "1927년에 창립된 민족 협동 단체에 대한 설명으로 옳은 것은?",
    explanation: "신간회(1927)는 비타협적 민족주의와 사회주의 세력이 연합한 민족 유일당으로, 광주 학생 항일 운동에 조사단을 파견하였다.",
    choices: ["만민 공동회를 열었다.", "독립문을 세웠다.", "봉오동 전투를 이끌었다.", "대한매일신보를 창간하였다.", "광주 학생 항일 운동에 조사단을 파견하였다."] },
  { level: "GIBON", examRound: 62, era: "samguk", qType: "개념형", topics: ["삼한", "소도", "천군"], difficulty: 1, answerIndex: 3,
    stem: "삼한에 대한 설명으로 옳은 것은?",
    explanation: "삼한에는 제사장인 천군과 신성 지역인 소도가 있었으며, 5월과 10월에 계절제를 지냈다.",
    choices: ["영고를 열었다.", "사출도가 있었다.", "민며느리제가 있었다.", "소도라는 신성 지역이 있었다.", "골품제가 있었다."] },
  { level: "SIMHWA", examRound: 63, era: "nambukguk", qType: "인물형", topics: ["장보고", "청해진", "통일신라"], difficulty: 2, answerIndex: 2,
    stem: "다음 인물에 대한 설명으로 옳은 것은? — 완도에 청해진을 설치하고 해상 무역을 장악하였다.",
    explanation: "장보고는 완도에 청해진을 설치하여 당·신라·일본을 잇는 해상 무역을 주도하였다.",
    choices: ["발해를 건국하였다.", "녹읍을 폐지하였다.", "청해진을 거점으로 해상 무역을 장악하였다.", "독서삼품과를 시행하였다.", "9주 5소경을 정비하였다."] },
  { level: "GIBON", examRound: 60, era: "modern", qType: "개념형", topics: ["독립협회", "만민공동회", "독립문"], difficulty: 1, answerIndex: 1,
    stem: "서재필 등이 창립한 단체에 대한 설명으로 옳은 것은?",
    explanation: "독립협회는 독립문을 세우고 만민 공동회를 개최하여 자주 국권과 민권 신장을 추구하였다.",
    choices: ["대성학교를 세웠다.", "만민 공동회를 개최하였다.", "봉오동 전투를 이끌었다.", "한국광복군을 창설하였다.", "물산 장려 운동을 폈다."] },
  { level: "SIMHWA", examRound: 67, era: "contemporary", qType: "순서나열형", topics: ["유신 헌법", "박정희", "1972"], difficulty: 3, answerIndex: 4,
    stem: "1972년에 제정된 헌법에 대한 설명으로 옳은 것은?",
    explanation: "유신 헌법(1972)은 대통령에게 긴급 조치권을 부여하고 통일 주체 국민 회의에서 대통령을 선출하도록 하였다.",
    choices: ["대통령 직선제를 규정하였다.", "내각 책임제를 채택하였다.", "3·15 부정 선거의 근거가 되었다.", "5·18 민주화 운동으로 폐지되었다.", "통일 주체 국민 회의에서 대통령을 선출하게 하였다."] },
  { level: "GIBON", examRound: 69, era: "joseon", qType: "지도형", topics: ["대동여지도", "김정호"], difficulty: 1, answerIndex: 0,
    stem: "김정호가 제작한, 목판으로 인쇄된 우리나라 전도로 옳은 것은?",
    explanation: "대동여지도는 김정호가 제작한 정밀한 전국 지도로, 목판으로 인쇄되어 휴대와 보급이 쉬웠다.",
    choices: ["대동여지도", "혼일강리역대국도지도", "천상열차분야지도", "곤여만국전도", "동국지도"] },
];

// 연표·관계망·플래시카드·튜터 RAG 근거가 되는 핵심 사실 (시대별 풍부화)
const facts = [
  { era: "gojoseon", year: -2333, title: "고조선 건국", kind: "event", body: "단군왕검이 아사달에 도읍하여 고조선을 건국하였다고 전한다.", relatedTo: ["단군왕검", "8조법"] },
  { era: "gojoseon", year: -194, title: "위만 집권", kind: "person", body: "위만이 준왕을 몰아내고 고조선의 왕이 되어 철기 문화를 본격 수용하였다.", relatedTo: ["고조선 건국"] },
  { era: "gojoseon", year: -108, title: "고조선 멸망", kind: "event", body: "한 무제의 침공으로 왕검성이 함락되어 멸망하고 한 군현이 설치되었다.", relatedTo: ["위만 집권"] },
  { era: "samguk", year: 372, title: "고구려 불교 수용", kind: "event", body: "소수림왕 때 전진의 순도가 불교를 전하였고, 태학 설립·율령 반포로 중앙집권을 강화하였다.", relatedTo: ["소수림왕"] },
  { era: "samguk", year: 384, title: "백제 불교 수용", kind: "event", body: "침류왕 때 동진의 마라난타가 불교를 전하였다.", relatedTo: ["근초고왕"] },
  { era: "samguk", year: 391, title: "광개토 대왕 즉위", kind: "person", body: "영락 연호를 사용하며 만주와 한강 이북으로 영토를 크게 넓혔다.", relatedTo: ["장수왕", "광개토 대왕릉비"] },
  { era: "samguk", year: 427, title: "장수왕 평양 천도", kind: "event", body: "장수왕이 평양으로 천도하고 남진 정책을 추진해 백제 한성을 함락하였다.", relatedTo: ["광개토 대왕 즉위", "충주 고구려비"] },
  { era: "samguk", year: 527, title: "신라 불교 공인", kind: "event", body: "법흥왕 때 이차돈의 순교를 계기로 불교가 공인되었다.", relatedTo: ["법흥왕"] },
  { era: "samguk", year: 612, title: "살수 대첩", kind: "event", body: "을지문덕이 수 양제의 대군을 살수에서 크게 무찔렀다.", relatedTo: ["고구려 불교 수용"] },
  { era: "samguk", year: 645, title: "안시성 싸움", kind: "event", body: "당 태종의 침입을 안시성에서 격퇴하였다.", relatedTo: ["살수 대첩"] },
  { era: "samguk", year: 660, title: "백제 멸망", kind: "event", body: "나당 연합군의 공격으로 사비성이 함락되어 백제가 멸망하였다.", relatedTo: ["성왕 사비 천도"] },
  { era: "samguk", year: 668, title: "고구려 멸망", kind: "event", body: "나당 연합군에 의해 평양성이 함락되어 고구려가 멸망하였다.", relatedTo: ["백제 멸망"] },
  { era: "nambukguk", year: 676, title: "신라 삼국 통일", kind: "event", body: "문무왕 때 매소성·기벌포에서 당군을 물리치고 삼국 통일을 완성하였다.", relatedTo: ["고구려 멸망", "신문왕"] },
  { era: "nambukguk", year: 682, title: "신문왕 개혁", kind: "person", body: "9주 5소경 정비, 국학 설립, 관료전 지급과 녹읍 폐지로 왕권을 강화하였다.", relatedTo: ["신라 삼국 통일"] },
  { era: "nambukguk", year: 698, title: "발해 건국", kind: "event", body: "대조영이 동모산에서 발해를 건국하며 고구려 계승 의식을 표방하였다.", relatedTo: ["발해 문왕"] },
  { era: "nambukguk", year: 828, title: "청해진 설치", kind: "person", body: "장보고가 완도에 청해진을 세워 해상 무역을 장악하였다.", relatedTo: ["신라 삼국 통일"] },
  { era: "goryeo", year: 918, title: "고려 건국", kind: "event", body: "왕건이 궁예를 몰아내고 고려를 건국하였다.", relatedTo: ["후삼국 통일", "광종"] },
  { era: "goryeo", year: 936, title: "후삼국 통일", kind: "event", body: "고려가 신라의 항복과 후백제 정벌로 후삼국을 통일하였다.", relatedTo: ["고려 건국"] },
  { era: "goryeo", year: 956, title: "노비안검법", kind: "system", body: "광종이 불법으로 노비가 된 자를 해방하여 호족 세력을 약화시켰다.", relatedTo: ["광종", "과거제 시행"] },
  { era: "goryeo", year: 958, title: "과거제 시행", kind: "system", body: "광종이 쌍기의 건의로 과거제를 처음 시행하였다.", relatedTo: ["노비안검법", "광종"] },
  { era: "goryeo", year: 982, title: "시무 28조", kind: "system", body: "최승로가 성종에게 올려 유교 정치 이념과 12목 설치의 바탕이 되었다.", relatedTo: ["과거제 시행"] },
  { era: "goryeo", year: 993, title: "서희의 외교 담판", kind: "person", body: "거란의 1차 침입 때 서희가 외교로 강동 6주를 확보하였다.", relatedTo: ["귀주 대첩"] },
  { era: "goryeo", year: 1019, title: "귀주 대첩", kind: "event", body: "강감찬이 거란군을 귀주에서 크게 무찔렀다.", relatedTo: ["서희의 외교 담판"] },
  { era: "goryeo", year: 1170, title: "무신정변", kind: "event", body: "정중부 등 무신들이 정변을 일으켜 권력을 장악하였다.", relatedTo: ["만적의 난"] },
  { era: "goryeo", year: 1198, title: "만적의 난", kind: "event", body: "최충헌의 사노 만적이 신분 해방을 도모한 봉기를 계획하였다.", relatedTo: ["무신정변"] },
  { era: "goryeo", year: 1236, title: "팔만대장경 조판", kind: "culture", body: "몽골 침입을 부처의 힘으로 막고자 강화도에서 제작, 현재 해인사 보관.", relatedTo: ["무신정변"] },
  { era: "goryeo", year: 1377, title: "직지심체요절", kind: "culture", body: "청주 흥덕사에서 간행된 현존 최고(最古)의 금속 활자본.", relatedTo: ["팔만대장경 조판"] },
  { era: "goryeo", year: 1388, title: "위화도 회군", kind: "event", body: "이성계가 요동 정벌 중 회군하여 권력을 장악, 조선 건국의 발판이 되었다.", relatedTo: ["조선 건국"] },
  { era: "joseon", year: 1392, title: "조선 건국", kind: "event", body: "이성계가 정도전 등과 함께 조선을 건국하였다.", relatedTo: ["위화도 회군", "한양 천도"] },
  { era: "joseon", year: 1446, title: "훈민정음 반포", kind: "culture", body: "세종이 집현전 학자들과 훈민정음을 창제·반포하였다.", relatedTo: ["조선 건국"] },
  { era: "joseon", year: 1485, title: "경국대전 완성", kind: "system", body: "성종 때 조선의 기본 법전인 경국대전이 완성·반포되었다.", relatedTo: ["훈민정음 반포"] },
  { era: "joseon", year: 1592, title: "임진왜란", kind: "event", body: "일본의 침략으로 시작된 전쟁. 이순신의 수군과 의병이 활약하였다.", relatedTo: ["한산도 대첩", "병자호란"] },
  { era: "joseon", year: 1608, title: "대동법 실시", kind: "system", body: "광해군 때 경기도에서 처음 시행, 공납을 토지 기준 쌀로 바꾸고 공인이 등장하였다.", relatedTo: ["임진왜란"] },
  { era: "joseon", year: 1636, title: "병자호란", kind: "event", body: "청의 침입으로 인조가 남한산성에서 항전하다 삼전도에서 항복하였다.", relatedTo: ["임진왜란"] },
  { era: "joseon", year: 1750, title: "균역법", kind: "system", body: "영조가 군포 부담을 2필에서 1필로 줄여 백성의 부담을 덜었다.", relatedTo: ["탕평책"] },
  { era: "joseon", year: 1796, title: "수원 화성 완공", kind: "culture", body: "정조가 정약용의 거중기를 활용해 축조, 정치·군사적 중심지로 삼았다.", relatedTo: ["균역법"] },
  { era: "modern", year: 1863, title: "흥선대원군 집권", kind: "person", body: "서원 철폐·호포제·경복궁 중건·척화비 건립 등 개혁과 통상 수교 거부를 추진하였다.", relatedTo: ["강화도 조약"] },
  { era: "modern", year: 1876, title: "강화도 조약", kind: "event", body: "운요호 사건을 계기로 체결된 최초의 근대적·불평등 조약. 부산 등 개항.", relatedTo: ["흥선대원군 집권", "갑신정변"] },
  { era: "modern", year: 1884, title: "갑신정변", kind: "event", body: "급진 개화파가 우정총국 개국 축하연을 이용해 정변을 일으켰으나 3일 만에 실패하였다.", relatedTo: ["강화도 조약", "동학 농민 운동"] },
  { era: "modern", year: 1894, title: "동학 농민 운동", kind: "event", body: "전봉준 등이 반봉건·반외세를 내걸고 봉기, 갑오개혁의 배경이 되었다.", relatedTo: ["갑신정변", "갑오개혁"] },
  { era: "modern", year: 1897, title: "대한제국 선포", kind: "event", body: "고종이 환구단에서 황제 즉위, 광무개혁을 추진하였다.", relatedTo: ["독립협회"] },
  { era: "modern", year: 1905, title: "을사늑약", kind: "event", body: "외교권을 박탈당하고 통감부가 설치되었다. 헤이그 특사 파견의 배경.", relatedTo: ["대한제국 선포", "신민회"] },
  { era: "modern", year: 1907, title: "신민회", kind: "system", body: "안창호·양기탁의 비밀 결사. 공화정 지향, 대성학교·오산학교 설립.", relatedTo: ["을사늑약"] },
  { era: "japanese", year: 1910, title: "국권 피탈", kind: "event", body: "한일 병합으로 국권을 상실, 1910년대 무단 통치가 시작되었다.", relatedTo: ["3·1 운동"] },
  { era: "japanese", year: 1919, title: "3·1 운동", kind: "event", body: "전국적 만세 시위. 대한민국 임시정부 수립의 계기가 되었다.", relatedTo: ["대한민국 임시정부", "국권 피탈"] },
  { era: "japanese", year: 1920, title: "봉오동·청산리 전투", kind: "event", body: "홍범도와 김좌진 등이 만주에서 일본군에 큰 승리를 거두었다.", relatedTo: ["3·1 운동", "의열단"] },
  { era: "japanese", year: 1927, title: "신간회 창립", kind: "system", body: "민족주의·사회주의 연합의 민족 유일당. 광주 학생 운동에 조사단 파견.", relatedTo: ["광주 학생 항일 운동"] },
  { era: "japanese", year: 1932, title: "윤봉길 의거", kind: "person", body: "한인 애국단의 윤봉길이 상하이 훙커우 공원에서 의거를 일으켰다.", relatedTo: ["대한민국 임시정부", "한국광복군"] },
  { era: "japanese", year: 1940, title: "한국광복군 창설", kind: "system", body: "대한민국 임시정부가 충칭에서 창설, 국내 진공 작전을 준비하였다.", relatedTo: ["윤봉길 의거"] },
  { era: "contemporary", year: 1945, title: "8·15 광복", kind: "event", body: "일본의 항복으로 광복을 맞았다.", relatedTo: ["대한민국 정부 수립"] },
  { era: "contemporary", year: 1948, title: "대한민국 정부 수립", kind: "event", body: "5·10 총선거를 거쳐 제헌 국회 구성, 대한민국 정부가 수립되었다.", relatedTo: ["8·15 광복", "6·25 전쟁"] },
  { era: "contemporary", year: 1950, title: "6·25 전쟁", kind: "event", body: "북한의 남침으로 발발, 1953년 정전 협정으로 멈췄다.", relatedTo: ["대한민국 정부 수립"] },
  { era: "contemporary", year: 1960, title: "4·19 혁명", kind: "event", body: "3·15 부정 선거에 항거, 이승만 대통령이 하야하였다.", relatedTo: ["6월 민주항쟁"] },
  { era: "contemporary", year: 1972, title: "7·4 남북 공동 성명", kind: "event", body: "자주·평화·민족 대단결의 통일 원칙에 합의하였다.", relatedTo: ["6·15 남북 공동 선언"] },
  { era: "contemporary", year: 1980, title: "5·18 민주화 운동", kind: "event", body: "광주에서 신군부에 맞선 민주화 운동.", relatedTo: ["4·19 혁명", "6월 민주항쟁"] },
  { era: "contemporary", year: 1987, title: "6월 민주항쟁", kind: "event", body: "6·29 선언과 대통령 직선제 개헌을 이끌어냈다.", relatedTo: ["5·18 민주화 운동"] },
  { era: "contemporary", year: 2000, title: "6·15 남북 공동 선언", kind: "event", body: "분단 후 첫 남북 정상 회담의 결과로 발표되었다.", relatedTo: ["7·4 남북 공동 성명"] },
];

// 60~69회 회차별 릴리스(업데이트 내역) 생성용
const rounds = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69];

async function main() {
  await prisma.choice.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.fact.deleteMany({});
  await prisma.release.deleteMany({});

  for (const q of questions) {
    await prisma.question.create({
      data: {
        level: q.level,
        examRound: q.examRound,
        examYear: yearOf[q.examRound] ?? null,
        stem: q.stem,
        passage: q.passage ?? null,
        explanation: q.explanation,
        answerIndex: q.answerIndex,
        era: q.era,
        topics: JSON.stringify(q.topics),
        qType: q.qType,
        difficulty: q.difficulty,
        source: "SEED",
        choices: { create: q.choices.map((text, order) => ({ text, order })) },
      },
    });
  }

  for (const f of facts) {
    await prisma.fact.create({ data: { ...f, relatedTo: JSON.stringify(f.relatedTo) } });
  }

  // 회차별 누적 릴리스 — 60회부터 순차 발행한 것처럼 기록
  let version = 0;
  let cumulative = 0;
  for (const round of rounds) {
    version++;
    const added = questions.filter((q) => q.examRound === round).length;
    cumulative += added;
    const simhwa = questions.filter((q) => q.examRound === round && q.level === "SIMHWA").length;
    const gibon = added - simhwa;
    await prisma.release.create({
      data: {
        version,
        title: `${round}회 문항 반영`,
        notes: `${round}회 형식 기준 ${added}문항 추가 (심화 ${simhwa} / 기본 ${gibon}). 시대·유형별로 분류·태깅하였습니다.`,
        examRound: round,
        examLevel: "BOTH",
        questionCount: cumulative,
        addedCount: added,
      },
    });
  }

  const qc = await prisma.question.count();
  const fc = await prisma.fact.count();
  const rc = await prisma.release.count();
  console.log(`시드 완료: 문항 ${qc}개, 사실 ${fc}개, 릴리스 ${rc}건(60~69회)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
