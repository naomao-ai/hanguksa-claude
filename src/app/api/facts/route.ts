import { NextRequest } from "next/server";
import { cachedJson } from "@/lib/http";
import { getFacts } from "@/lib/firestore";

export const dynamic = "force-dynamic";

// GET /api/facts?era=&kind=
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const facts = await getFacts(sp.get("era"), sp.get("kind"));
  return cachedJson({ facts }, 120);
}
