import { cachedJson } from "@/lib/http";
import { getAllQuestions } from "@/lib/firestore";

export const dynamic = "force-dynamic";

// GET /api/analytics/trends — 문제은행 기준 출제경향 집계
export async function GET() {
  const all = await getAllQuestions();

  const byEra: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const byRound: Record<string, { round: number; total: number; simhwa: number; gibon: number; eras: Record<string, number> }> = {};
  
  // 새로 추가할 집계 객체
  const eraPosMap: Record<string, { sum: number; count: number; min: number; max: number }> = {};
  const eraTopicsMap: Record<string, Record<string, number>> = {};

  let simhwa = 0;
  let gibon = 0;
  let diffSum = 0;
  let diffCount = 0;

  for (const q of all) {
    byEra[q.era] = (byEra[q.era] || 0) + 1;
    byType[q.qType] = (byType[q.qType] || 0) + 1;
    if (q.level === "SIMHWA") simhwa++;
    else gibon++;
    
    if (q.difficulty) {
      diffSum += q.difficulty;
      diffCount++;
      byDifficulty[String(q.difficulty)] = (byDifficulty[String(q.difficulty)] || 0) + 1;
    }
    
    if (q.examRound != null) {
      const key = String(q.examRound);
      if (!byRound[key]) byRound[key] = { round: q.examRound, total: 0, simhwa: 0, gibon: 0, eras: {} };
      byRound[key].total++;
      if (q.level === "SIMHWA") byRound[key].simhwa++;
      else byRound[key].gibon++;
      byRound[key].eras[q.era] = (byRound[key].eras[q.era] || 0) + 1;
    }

    // 1) 문항 순번 통계 (주로 어느 번호대에서 출제되는지)
    if (q.number != null) {
      if (!eraPosMap[q.era]) eraPosMap[q.era] = { sum: 0, count: 0, min: 999, max: -1 };
      eraPosMap[q.era].sum += q.number;
      eraPosMap[q.era].count++;
      if (q.number < eraPosMap[q.era].min) eraPosMap[q.era].min = q.number;
      if (q.number > eraPosMap[q.era].max) eraPosMap[q.era].max = q.number;
    }

    // 2) 시대별 세부 주제 통계
    if (q.topics && q.topics.length > 0) {
      if (!eraTopicsMap[q.era]) eraTopicsMap[q.era] = {};
      for (const t of q.topics) {
        eraTopicsMap[q.era][t] = (eraTopicsMap[q.era][t] || 0) + 1;
      }
    }
  }

  // 1-1) 문항 순번 결과 가공
  const eraPositions = Object.entries(eraPosMap).reduce((acc, [era, data]) => {
    acc[era] = {
      avg: Math.round((data.sum / data.count) * 10) / 10,
      min: data.min,
      max: data.max
    };
    return acc;
  }, {} as Record<string, { avg: number; min: number; max: number }>);

  // 2-1) 세부 주제 결과 가공 (상위 5개 추출)
  const topTopics = Object.entries(eraTopicsMap).reduce((acc, [era, tMap]) => {
    acc[era] = Object.entries(tMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(x => ({ topic: x[0], count: x[1] }));
    return acc;
  }, {} as Record<string, { topic: string; count: number }[]>);

  // 3) 다음 회차 예측 로직 (Weighted Moving Average)
  const roundsArr = Object.values(byRound).sort((a, b) => a.round - b.round);
  const last5 = roundsArr.slice(-5);
  const weights = [1, 2, 3, 4, 5]; // 인덱스가 클수록(최신일수록) 높은 가중치
  
  let predictedNextRound: { eras: Record<string, number> } | null = null;
  if (last5.length > 0) {
    const eraWma: Record<string, number> = {};
    let totalWeight = 0;
    
    // 사용 가능한 가중치 배열 슬라이싱 (회차가 5개 미만일 수 있음)
    const usedWeights = weights.slice(5 - last5.length);
    
    last5.forEach((r, idx) => {
      const w = usedWeights[idx];
      totalWeight += w;
      for (const era of Object.keys(r.eras)) {
        eraWma[era] = (eraWma[era] || 0) + (r.eras[era] * w);
      }
    });

    const predictedEras: Record<string, number> = {};
    for (const era in eraWma) {
      // 소수점 첫째자리까지 반올림하여 예상 문항 수 산출
      predictedEras[era] = Math.round((eraWma[era] / totalWeight) * 10) / 10;
    }

    predictedNextRound = {
      eras: predictedEras
    };
  }

  return cachedJson({
    total: all.length,
    byEra,
    byType,
    byDifficulty,
    byLevel: { SIMHWA: simhwa, GIBON: gibon },
    byRound: roundsArr,
    avgDifficulty: diffCount ? diffSum / diffCount : null,
    eraPositions,
    topTopics,
    predictedNextRound
  }, 30);
}
