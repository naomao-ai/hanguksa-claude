import { NextRequest, NextResponse } from "next/server";
import { getFacts } from "@/lib/firestore";
import { ERAS } from "@/lib/domain";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eraFilter = searchParams.get("era");
    const categoryFilter = searchParams.get("category");
    const qFilter = searchParams.get("q")?.toLowerCase();

    let facts = await getFacts();

    // 서버 사이드 필터링 적용
    if (eraFilter) facts = facts.filter((f) => f.era === eraFilter);
    if (categoryFilter) facts = facts.filter((f) => f.category === categoryFilter);
    if (qFilter) {
      facts = facts.filter((f) => 
        f.title.toLowerCase().includes(qFilter) ||
        f.keywords.some((k) => k.toLowerCase().includes(qFilter)) ||
        f.body.toLowerCase().includes(qFilter)
      );
    }

    const nodes: any[] = [];
    const edges: any[] = [];

    // 1. Era 노드 생성
    const activeEras = new Set(facts.map(f => f.era));
    for (const era of ERAS) {
      if (!activeEras.has(era.key) && !eraFilter) continue; // 필터링 시 표시할 시대만
      nodes.push({
        id: `era-${era.key}`,
        type: "era",
        label: era.label,
        color: era.color,
      });
    }

    // 2. Fact 및 Keyword 노드 생성
    const keywords = new Set<string>();

    for (const f of facts) {
      nodes.push({
        id: f.id,
        type: "fact",
        label: f.title,
        era: f.era,
        year: f.year,
        category: f.category,
        importance: f.importance || 1,
        questionCount: f.questionCount || 0,
      });

      // Fact -> Era 엣지
      edges.push({
        source: f.id,
        target: `era-${f.era}`,
        type: "era-link",
      });

      // Keyword 엣지
      for (const kw of f.keywords) {
        if (!kw) continue;
        keywords.add(kw);
        edges.push({
          source: f.id,
          target: `kw-${kw}`,
          type: "keyword-link",
        });
      }
    }

    // Keyword 노드 추가
    for (const kw of keywords) {
      nodes.push({
        id: `kw-${kw}`,
        type: "keyword",
        label: kw,
      });
    }

    return NextResponse.json({ success: true, graph: { nodes, edges } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
