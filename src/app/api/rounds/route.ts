import { cachedJson } from "@/lib/http";
import { getRounds } from "@/lib/firestore";

export const dynamic = "force-dynamic";

// GET /api/rounds — 문제은행에 존재하는 회차 목록(내림차순)
export async function GET() {
  const rounds = await getRounds();
  return cachedJson({ rounds }, 30);
}
