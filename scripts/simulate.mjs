// 기능/안정성 시뮬레이션 하네스
// 사용법: node scripts/simulate.mjs [iterations] [mode]
//   mode: functional(기본) | perf
// 서버가 http://localhost:3000 에서 실행 중이어야 함.

const BASE = process.env.BASE || "http://localhost:3000";
const ITER = Number(process.argv[2] || 30);
const MODE = process.argv[3] || "functional";
const ADMIN_PW = process.env.ADMIN_PASSWORD || "admin1234";

const ERAS = ["prehistoric","gojoseon","samguk","nambukguk","goryeo","joseon","modern","japanese","contemporary"];
const QTYPES = ["자료제시형","순서나열형","인물형","지도형","개념형","기타"];

const lat = [];
const failures = [];
let checks = 0;

function rec(ms) { lat.push(ms); }
function fail(msg) { failures.push(msg); }
function ok(cond, msg) { checks++; if (!cond) fail(msg); }

async function get(path) {
  const t = performance.now();
  const res = await fetch(BASE + path);
  rec(performance.now() - t);
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function login() {
  const res = await fetch(BASE + "/api/admin/login", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PW }),
  });
  const cookie = res.headers.get("set-cookie");
  return cookie ? cookie.split(";")[0] : null;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function functionalIteration(i, cookie) {
  // 1) 시대 필터 정확성
  const era = pick(ERAS);
  const r1 = await get(`/api/questions?era=${era}&limit=500`);
  ok(r1.status === 200, `era=${era} status ${r1.status}`);
  ok((r1.body?.questions || []).every((q) => q.era === era), `era 필터 누수: ${era}`);

  // 2) 등급 필터
  const level = pick(["SIMHWA", "GIBON"]);
  const r2 = await get(`/api/questions?level=${level}&limit=500`);
  ok((r2.body?.questions || []).every((q) => q.level === level), `level 필터 누수: ${level}`);

  // 3) 유형 필터
  const qt = pick(QTYPES);
  const r3 = await get(`/api/questions?qType=${encodeURIComponent(qt)}&limit=500`);
  ok((r3.body?.questions || []).every((q) => q.qType === qt), `qType 필터 누수: ${qt}`);

  // 4) 전체 적재 + 파생 검증
  const all = await get(`/api/questions?limit=500`);
  const qs = all.body?.questions || [];
  ok(qs.every((q) => Array.isArray(q.choices) && q.choices.length >= 2), "선지 2개 미만 문항 존재");
  ok(qs.every((q) => q.answerIndex >= 0 && q.answerIndex < q.choices.length), "정답 인덱스 범위 오류");
  ok(qs.every((q) => ERAS.includes(q.era)), "알 수 없는 시대 키 존재");

  // 5) 키워드 검색: 임의 문항의 토큰으로 검색 → 결과 포함성
  if (qs.length) {
    const sample = pick(qs);
    const token = (sample.stem.match(/[가-힣]{2,}/g) || [])[0];
    if (token) {
      const r = await get(`/api/questions?q=${encodeURIComponent(token)}&limit=500`);
      const hit = (r.body?.questions || []).every(
        (q) => q.stem.includes(token) || (q.passage || "").includes(token) || q.topics.some((t) => t.includes(token))
      );
      ok(hit, `검색 결과에 '${token}' 미포함 항목`);
      ok((r.body?.questions || []).some((q) => q.id === sample.id), `검색이 원본 문항 누락: '${token}'`);
    }
  }

  // 6) ids 순서/부분집합
  if (qs.length >= 3) {
    const ids = [...qs].sort(() => Math.random() - 0.5).slice(0, 3).map((q) => q.id);
    const r = await get(`/api/questions?ids=${ids.join(",")}`);
    const got = (r.body?.questions || []).map((q) => q.id);
    ok(JSON.stringify(got) === JSON.stringify(ids), `ids 순서 불일치: ${ids} → ${got}`);
  }

  // 7) random 상한
  const k = pick([5, 10, 20]);
  const rr = await get(`/api/questions?random=1&limit=${k}`);
  const rids = (rr.body?.questions || []).map((q) => q.id);
  ok(rids.length <= k, `random limit 초과: ${rids.length}>${k}`);
  ok(new Set(rids).size === rids.length, "random 결과 중복 id");

  // 8) 통계 합계 일치
  const tr = await get(`/api/analytics/trends`);
  const sumEra = Object.values(tr.body?.byEra || {}).reduce((a, b) => a + b, 0);
  ok(sumEra === tr.body?.total, `trends byEra 합(${sumEra})≠total(${tr.body?.total})`);
  ok(tr.body?.byLevel?.SIMHWA + tr.body?.byLevel?.GIBON === tr.body?.total, "trends byLevel 합 불일치");

  // 9) releases 메타 = 문항수
  const rel = await get(`/api/releases`);
  ok(rel.body?.meta?.total === qs.length, `releases meta.total(${rel.body?.meta?.total})≠실제(${qs.length})`);

  // 10) 무인증 쓰기 차단
  const noauth = await fetch(BASE + "/api/questions", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ stem: "x", choices: ["a", "b"], answerIndex: 0, era: "joseon" }),
  });
  ok(noauth.status === 401, `무인증 생성 차단 실패: ${noauth.status}`);

  // 11) 관리자 생성→조회→삭제 사이클 (5회마다)
  if (cookie && i % 5 === 0) {
    const stem = `SIMTEST-${Date.now()}-${i}`;
    const cr = await fetch(BASE + "/api/questions", {
      method: "POST", headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ level: "SIMHWA", stem, choices: ["가", "나", "다"], answerIndex: 1, era: "goryeo", qType: "개념형", topics: ["시뮬"] }),
    });
    const cd = await cr.json().catch(() => null);
    ok(cr.status === 200 && cd?.question?.id, `관리자 생성 실패: ${cr.status}`);
    if (cd?.question?.id) {
      const find = await get(`/api/questions?q=${encodeURIComponent(stem)}`);
      ok((find.body?.questions || []).some((q) => q.id === cd.question.id), "생성 문항 검색 누락");
      const del = await fetch(BASE + `/api/questions/${cd.question.id}`, { method: "DELETE", headers: { cookie } });
      ok(del.status === 200, `관리자 삭제 실패: ${del.status}`);
      const gone = await get(`/api/questions/${cd.question.id}`);
      ok(gone.status === 404, "삭제 후에도 문항 존재");
    }
  }
}

async function perfIteration() {
  // 동시 요청 버스트로 안정성/지연 측정
  await Promise.all([
    get(`/api/questions?random=1&limit=20`),
    get(`/api/questions?era=${pick(ERAS)}&limit=100`),
    get(`/api/facts`),
    get(`/api/analytics/trends`),
    get(`/api/releases`),
    get(`/api/questions?q=${encodeURIComponent("광종")}`),
  ]);
}

async function main() {
  console.log(`[시뮬레이션] mode=${MODE} iterations=${ITER} base=${BASE}`);
  const cookie = await login();
  console.log(cookie ? "관리자 로그인 OK" : "관리자 로그인 실패(쓰기 사이클 생략)");

  const t0 = performance.now();
  for (let i = 1; i <= ITER; i++) {
    try {
      if (MODE === "perf") await perfIteration();
      else await functionalIteration(i, cookie);
    } catch (e) {
      fail(`iteration ${i} 예외: ${e.message}`);
    }
  }
  const total = performance.now() - t0;

  lat.sort((a, b) => a - b);
  const sum = lat.reduce((a, b) => a + b, 0);
  const p = (q) => lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * q))] : 0;

  console.log(`\n요청 ${lat.length}건 · 평균 ${(sum / (lat.length||1)).toFixed(1)}ms · p50 ${p(0.5).toFixed(0)}ms · p95 ${p(0.95).toFixed(0)}ms · max ${(lat[lat.length-1]||0).toFixed(0)}ms`);
  if (MODE !== "perf") console.log(`검증 ${checks}건`);
  console.log(`총 소요 ${(total / 1000).toFixed(1)}s`);

  if (failures.length === 0) {
    console.log(`\n✅ 실패 0건 — 모든 검증 통과`);
  } else {
    console.log(`\n❌ 실패 ${failures.length}건:`);
    const counts = {};
    for (const f of failures) counts[f] = (counts[f] || 0) + 1;
    for (const [msg, n] of Object.entries(counts)) console.log(`  (${n}회) ${msg}`);
    process.exitCode = 1;
  }
}

main();
