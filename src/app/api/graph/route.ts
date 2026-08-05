import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase-admin";
import { ERAS } from "@/lib/domain";

/**
 * Graph API — 성능 최적화 버전
 *
 * 핵심 변경:
 * 1. 키워드 노드 제거 → Fact 노드의 메타데이터로만 보존
 * 2. 같은 키워드를 공유하는 Fact 간 직접 엣지 생성
 * 3. Firestore 쿼리 1회만 (getAllQuestions 중복 호출 제거)
 * 4. 응답에서 wikiMeta, details 제거 (클릭 시 별도 API로 조회)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const eraFilter = searchParams.get("era");
    const categoryFilter = searchParams.get("category");
    const qFilter = searchParams.get("q")?.toLowerCase();

    // Firestore에서 facts와 questions를 병렬로 1회만 조회
    const [factSnap, questionSnap] = await Promise.all([
      db.collection("facts").get(),
      db.collection("questions").get(),
    ]);

    // --- Facts 처리 ---
    interface FactRow {
      id: string;
      era: string;
      year: number | null;
      title: string;
      kind: string;
      category: string | null;
      importance: number;
      keywords: string[];
      nextFactIds: string[];
      conceptEra: string | null;
    }

    let facts: FactRow[] = factSnap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        era: data.era,
        year: data.year ?? null,
        title: data.title,
        kind: data.kind ?? "event",
        category: data.category ?? null,
        importance: typeof data.importance === "number" ? data.importance : 1,
        keywords: Array.isArray(data.keywords) ? data.keywords.filter(Boolean) : [],
        nextFactIds: Array.isArray(data.nextFactIds) ? data.nextFactIds : [],
        conceptEra: typeof data.conceptEra === "string" ? data.conceptEra : null,
      };
    });

    // --- Questions 처리 ---
    interface QuestionRow {
      id: string;
      era: string;
      stem: string;
      factIds: string[];
    }

    let questions: QuestionRow[] = questionSnap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          era: data.era ?? "joseon",
          stem: data.stem ?? "",
          factIds: Array.isArray(data.factIds) ? data.factIds : [],
        };
      })
      .filter((q) => q.factIds.length > 0); // factIds가 있는 문항만

    // --- 서버 사이드 필터링 ---
    if (eraFilter) {
      facts = facts.filter((f) => f.era === eraFilter);
      questions = questions.filter((q) => q.era === eraFilter);
    }
    if (categoryFilter) facts = facts.filter((f) => f.category === categoryFilter);
    if (qFilter) {
      facts = facts.filter(
        (f) =>
          f.title.toLowerCase().includes(qFilter) ||
          f.keywords.some((k) => k.toLowerCase().includes(qFilter))
      );
      questions = questions.filter((q) => q.stem.toLowerCase().includes(qFilter));
    }

    // --- 그래프 구성 ---
    const nodes: any[] = [];
    const edges: any[] = [];
    const factIdSet = new Set<string>();

    // Fact별 연결 문항 수 및 ID 목록 사전 계산
    const questionCountMap = new Map<string, number>();
    const questionIdsMap = new Map<string, string[]>();
    for (const q of questions) {
      for (const fId of q.factIds) {
        questionCountMap.set(fId, (questionCountMap.get(fId) || 0) + 1);
        if (!questionIdsMap.has(fId)) questionIdsMap.set(fId, []);
        questionIdsMap.get(fId)!.push(q.id);
      }
    }

    // 시대 미상(era="unknown")의 학습 개념 노드는 별도 그룹으로 묶는다.
    // 데이터상 era 값은 그대로 두고, 표시(displayEra)만 "concept"으로 정규화.
    const CONCEPT_ERA = "concept"; // 가상 시대 키
    const ERA_KEY_SET = new Set(ERAS.map((e) => e.key));
    const isConceptFact = (f: FactRow) => f.kind === "concept" || f.era === "unknown";
    // 개념 노드는 conceptEra가 있으면 그 실제 시대 군집에 배치한다(색·토글은
    // 클라이언트가 kind="concept"으로 유지). conceptEra가 없으면 "학습 개념" 허브로.
    const displayEra = (f: FactRow) =>
      !isConceptFact(f)
        ? f.era
        : f.conceptEra && ERA_KEY_SET.has(f.conceptEra)
          ? f.conceptEra
          : CONCEPT_ERA;

    // 1. Fact 노드 생성 + factIdSet 구축
    for (const f of facts) {
      const concept = isConceptFact(f);
      nodes.push({
        id: f.id,
        type: "fact",
        // "[학습 맥락] XXX" 접두어 제거 → 개념명만 표시
        label: concept ? f.title.replace(/^\[학습\s*맥락\]\s*/, "") : f.title,
        kind: f.kind,
        era: displayEra(f),
        year: f.year,
        category: f.category,
        importance: f.importance,
        keywords: f.keywords,
        questionCount: questionCountMap.get(f.id) || 0,
        questionIds: questionIdsMap.get(f.id) || [],
      });
      factIdSet.add(f.id);
    }

    // 2. Era 노드 생성 (실제 시대)
    const activeEras = new Set(facts.map((f) => displayEra(f)));
    for (const era of ERAS) {
      if (!activeEras.has(era.key) && !eraFilter) continue;
      const id = `era-${era.key}`;
      nodes.push({ id, type: "era", label: era.label, color: era.color });

      // Fact → Era 엣지
      for (const f of facts) {
        if (displayEra(f) === era.key) {
          edges.push({ source: f.id, target: id, type: "era-link" });
        }
      }
    }

    // 2-b. "학습 개념" 그룹 노드 (기존 unknown 대체)
    if (activeEras.has(CONCEPT_ERA)) {
      const id = `era-${CONCEPT_ERA}`;
      nodes.push({ id, type: "era", label: "학습 개념", color: "#a78bfa" });
      for (const f of facts) {
        if (displayEra(f) === CONCEPT_ERA) {
          edges.push({ source: f.id, target: id, type: "era-link" });
        }
      }
    }

    // 3. 인과관계 엣지 (nextFactIds)
    for (const f of facts) {
      for (const nextId of f.nextFactIds) {
        if (factIdSet.has(nextId)) {
          edges.push({ source: f.id, target: nextId, type: "relation-link", relation: "effect" });
        }
      }
    }

    // 4. 공유 키워드 엣지 — 키워드 노드 대신 Fact끼리 직접 연결
    //    같은 키워드를 가진 Fact 쌍을 찾되, 연결 폭발 방지를 위해:
    //    - 2글자 이하 키워드 제외 (너무 일반적)
    //    - Fact당 공유 엣지 최대 5개
    const kwToFacts = new Map<string, string[]>();
    for (const f of facts) {
      for (const kw of f.keywords) {
        if (kw.length < 2) continue; // 1글자 키워드 제외
        if (!kwToFacts.has(kw)) kwToFacts.set(kw, []);
        kwToFacts.get(kw)!.push(f.id);
      }
    }

    const sharedEdgeSet = new Set<string>();
    const factSharedCount = new Map<string, number>(); // Fact별 공유 엣지 수 제한

    for (const [kw, fIds] of kwToFacts) {
      if (fIds.length < 2 || fIds.length > 50) continue; // 너무 많은 Fact를 가진 일반 키워드 제외
      for (let i = 0; i < fIds.length && i < 10; i++) {
        for (let j = i + 1; j < fIds.length && j < 10; j++) {
          const a = fIds[i], b = fIds[j];
          const key = a < b ? `${a}-${b}` : `${b}-${a}`;
          if (sharedEdgeSet.has(key)) continue;

          const countA = factSharedCount.get(a) || 0;
          const countB = factSharedCount.get(b) || 0;
          if (countA >= 5 || countB >= 5) continue;

          sharedEdgeSet.add(key);
          factSharedCount.set(a, countA + 1);
          factSharedCount.set(b, countB + 1);
          edges.push({ source: a, target: b, type: "keyword-link", keyword: kw });
        }
      }
    }

    // 5. 시대 내 연대순 흐름 엣지 — 인과관계 데이터가 비어 있어도
    //    같은 시대 사건을 연도순으로 이어 "시간 흐름" 뼈대를 제공한다.
    //    (개념 노드 제외, 이미 relation-link가 있는 쌍은 중복 생성 안 함)
    const relPairSet = new Set(
      edges
        .filter((e) => e.type === "relation-link")
        .map((e) => {
          const a = e.source as string, b = e.target as string;
          return a < b ? `${a}-${b}` : `${b}-${a}`;
        })
    );
    const byEraChrono = new Map<string, FactRow[]>();
    for (const f of facts) {
      if (f.year == null) continue;
      const key = displayEra(f);
      if (key === CONCEPT_ERA) continue; // 학습 개념 노드는 흐름에서 제외
      if (!byEraChrono.has(key)) byEraChrono.set(key, []);
      byEraChrono.get(key)!.push(f);
    }
    for (const [, arr] of byEraChrono) {
      arr.sort((a, b) => (a.year! - b.year!) || a.id.localeCompare(b.id));
      for (let i = 0; i < arr.length - 1; i++) {
        const a = arr[i].id, b = arr[i + 1].id;
        const pk = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (relPairSet.has(pk)) continue; // 인과관계가 이미 있으면 생략
        edges.push({ source: a, target: b, type: "chrono-link" });
      }
    }

    // Question 노드 렌더링은 제외됨 (그래프 혼잡도 개선)
    // Fact 노드 내의 questionCount, questionIds로 WikiPanel에서 접근

    return NextResponse.json({ success: true, graph: { nodes, edges } });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
