import { cachedJson } from "@/lib/http";
import { getAllQuestions } from "@/lib/firestore";

export const dynamic = "force-dynamic";

// GET /api/analytics/trends — 문제은행 기준 출제경향 집계
export async function GET() {
  const all = await getAllQuestions();

  const byEra: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byDifficulty: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  const byRound: Record<string, { round: number; total: number; eras: Record<string, number> }> = {};
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
      if (!byRound[key]) byRound[key] = { round: q.examRound, total: 0, eras: {} };
      byRound[key].total++;
      byRound[key].eras[q.era] = (byRound[key].eras[q.era] || 0) + 1;
    }
  }

  return cachedJson({
    total: all.length,
    byEra,
    byType,
    byDifficulty,
    byLevel: { SIMHWA: simhwa, GIBON: gibon },
    byRound: Object.values(byRound).sort((a, b) => a.round - b.round),
    avgDifficulty: diffCount ? diffSum / diffCount : null,
  }, 30);
}
