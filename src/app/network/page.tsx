"use client";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchFacts, fetchGraphData } from "@/lib/api";
import { ERAS, FACT_CATEGORIES } from "@/lib/domain";
import { eraLabel } from "@/lib/domain";
import { buildFactMap } from "@/lib/network";
import type { FactDTO } from "@/lib/types";
import type { GraphData } from "@/lib/network";
import { Loader2, Search, X, Flame, GitBranch, AlertCircle, BookOpen } from "lucide-react";
import WikiPanel from "@/components/WikiPanel";
import * as d3 from "d3";
import { loadStore, wrongQuestionIds } from "@/lib/local-store";

/* ─────────────────── helpers ─────────────────── */

function getRadius(node: any, degreeMap: Map<string, number>) {
  if (node.type === "era") return 24;
  const degree = degreeMap.get(node.id) || 0;
  if (node.type === "question") return 10 + Math.min(degree * 0.5, 6);
  let base = 8;
  if (node.importance === 3) base = 14;
  if (node.importance === 2) base = 11;
  return base + Math.min(degree * 0.4, 8);
}

function getColor(node: any) {
  if (node.type === "era") return node.color || "#94a3b8";
  if (node.type === "question") return "#60a5fa";
  // 학습 개념 노드(시대 미상)는 보라색 계열로 구분
  if (node.era === "concept" || node.kind === "concept") return "#a78bfa";
  return ERAS.find(e => e.key === node.era)?.color || "#94a3b8";
}

/** 시대 키 → 표시 라벨 (학습 개념 그룹 포함) */
function eraDisplayLabel(key: string | undefined): string {
  if (!key) return "";
  if (key === "concept") return "학습 개념";
  return eraLabel(key);
}

/** BFS로 인과 체인 탐색 (prevFactIds/nextFactIds 방향 그래프) */
function traceCausalChain(startId: string, nodes: any[], edges: any[]): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();
  const nodeMap = new Map(nodes.map((n: any) => [n.id, n]));

  // 역방향 탐색 (원인 추적) — relation-link의 target → source
  const backQueue = [startId];
  const backChain: string[] = [];
  const backVisited = new Set<string>();
  backVisited.add(startId);
  while (backQueue.length > 0) {
    const cur = backQueue.shift()!;
    for (const e of edges) {
      const src = typeof e.source === "object" ? e.source.id : e.source;
      const tgt = typeof e.target === "object" ? e.target.id : e.target;
      if (e.type === "relation-link" && tgt === cur && !backVisited.has(src)) {
        backVisited.add(src);
        backChain.unshift(src);
        backQueue.push(src);
      }
    }
  }

  // 정방향 탐색 (결과 추적) — relation-link의 source → target
  const fwdQueue = [startId];
  const fwdChain: string[] = [];
  const fwdVisited = new Set<string>();
  fwdVisited.add(startId);
  while (fwdQueue.length > 0) {
    const cur = fwdQueue.shift()!;
    for (const e of edges) {
      const src = typeof e.source === "object" ? e.source.id : e.source;
      const tgt = typeof e.target === "object" ? e.target.id : e.target;
      if (e.type === "relation-link" && src === cur && !fwdVisited.has(tgt)) {
        fwdVisited.add(tgt);
        fwdChain.push(tgt);
        fwdQueue.push(tgt);
      }
    }
  }

  return [...backChain, startId, ...fwdChain];
}

/* ─────────────────── component ─────────────────── */

function NetworkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFactId = searchParams.get("factId");

  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);

  const [era, setEra] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  const [selectedFactId, setSelectedFactId] = useState<string | null>(initialFactId);
  const hoveredNodeIdRef = useRef<string | null>(null);
  const hoveredNodeRef = useRef<any>(null); // 실제 노드 객체 (tooltip용)

  // Quick Access 필터 모드
  const [viewMode, setViewMode] = useState<"all" | "top" | "causal" | "weak">("all");

  // Onboarding Modal 상태 — 처음 방문한 사용자에게만 1회 표시
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<1 | 2>(1);
  const [onboardingType, setOnboardingType] = useState<"era" | "category" | "person" | null>(null);

  // 인과 체인 모드
  const [causalChainIds, setCausalChainIds] = useState<Set<string>>(new Set());

  // 시대 격리 모드 — era 노드 클릭 시 해당 시대 관계망만 표시
  const [eraFocus, setEraFocus] = useState<string | null>(null);

  // 학습 개념 레이어 표시 여부 (기본 숨김 — 그래프 혼잡 완화)
  const [showConcepts, setShowConcepts] = useState<boolean>(false);
  
  // 취약 영역 (오답 문항이 연결된 Fact ID 목록)
  const [wrongFactIds, setWrongFactIds] = useState<Set<string>>(new Set());

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodesRef = useRef<any[]>([]);
  const edgesRef = useRef<any[]>([]);
  const quadtreeRef = useRef<d3.Quadtree<any> | null>(null);
  const rafIdRef = useRef<number>(0);
  // 현재 격리 집합 (draw에서 갱신) — 호버 히트테스트에서 숨김 노드 차단용
  const visibleSetRef = useRef<Set<string> | null>(null);
  // draw/줌-핏을 외부 effect에서 트리거하기 위한 ref
  const drawRef = useRef<(() => void) | null>(null);
  const fitRef = useRef<((ids: Set<string>) => void) | null>(null);
  // 선택 상태를 draw 클로저에서 최신값으로 읽기 위한 ref (시뮬레이션 재생성 방지)
  const selectedFactIdRef = useRef<string | null>(null);
  const eraFocusRef = useRef<string | null>(null);
  const viewModeRef = useRef<string>("all");
  const causalChainIdsRef = useRef<Set<string>>(new Set());
  const wrongFactIdsRef = useRef<Set<string>>(new Set());
  // 상단 필터(시대/분류/검색/개념레이어)로 표시 가능한 노드 집합 (draw에서 하드 필터)
  const filterVisibleRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    // 클라이언트 마운트 시 로컬 스토어에서 오답 이력 로드
    const store = loadStore();
    const wqIds = new Set(wrongQuestionIds(store));
    
    // graphData가 로드된 이후에 wrongFactIds를 계산해야 하므로 별도 effect나 데이터 로드 직후에 처리.
    // 일단 wqIds 셋만 들고 있다가 graphData가 세팅될 때 계산하도록 합니다.
    window.sessionStorage.setItem("wrongQIds", JSON.stringify([...wqIds]));
  }, []);

  // 온보딩은 첫 방문에만 노출 (이후 방문은 건너뜀)
  useEffect(() => {
    try {
      if (!localStorage.getItem("network_onboarded")) setShowOnboarding(true);
    } catch { setShowOnboarding(true); }
  }, []);

  function closeOnboarding() {
    setShowOnboarding(false);
    try { localStorage.setItem("network_onboarded", "1"); } catch {}
  }

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    fetchFacts().then((f) => setFacts(f));
  }, []);

  const factMap = useMemo(() => buildFactMap(facts), [facts]);

  // draw 클로저가 최신 선택 상태를 refs로 읽도록 렌더 시 동기화
  selectedFactIdRef.current = selectedFactId;
  eraFocusRef.current = eraFocus;
  viewModeRef.current = viewMode;
  causalChainIdsRef.current = causalChainIds;
  wrongFactIdsRef.current = wrongFactIds;

  // 시대/분류/검색/개념레이어 → 표시 가능 노드 집합.
  // 시뮬레이션은 전체 그래프로 1회만 돌리고, 이 집합으로 draw에서만 걸러 낸다
  // (필터를 바꿔도 레이아웃이 튀지 않고 위치가 유지된다).
  const normalizedQuery = debouncedQuery.trim().toLowerCase();
  const filterVisible = useMemo<Set<string> | null>(() => {
    if (!graphData) return null;
    const noFilter = !era && !category && !normalizedQuery && showConcepts;
    if (noFilter) return null;
    const set = new Set<string>();
    const activeEras = new Set<string>();
    for (const n of graphData.nodes as any[]) {
      if (n.type !== "fact") continue;
      // 개념 레이어 토글은 kind 기준 — conceptEra로 실제 시대에 배치돼도 숨김 유지
      if (!showConcepts && n.kind === "concept") continue;
      if (era && n.era !== era) continue;
      if (category && n.category !== category) continue;
      if (normalizedQuery) {
        const inTitle = (n.label || "").toLowerCase().includes(normalizedQuery);
        const inKw = (n.keywords || []).some((k: string) => k.toLowerCase().includes(normalizedQuery));
        if (!inTitle && !inKw) continue;
      }
      set.add(n.id);
      activeEras.add(n.era);
    }
    for (const n of graphData.nodes as any[]) {
      if (n.type !== "era") continue;
      const key = String(n.id).replace(/^era-/, "");
      if (!showConcepts && key === "concept") continue;
      if (era && key !== era) continue;
      if (!era && !activeEras.has(key)) continue;
      set.add(n.id);
    }
    return set;
  }, [graphData, showConcepts, era, category, normalizedQuery]);
  filterVisibleRef.current = filterVisible;

  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!graphData) return map;
    for (const edge of graphData.edges) {
      const src = typeof edge.source === "object" ? (edge.source as any).id : edge.source;
      const tgt = typeof edge.target === "object" ? (edge.target as any).id : edge.target;
      if (!map.has(src)) map.set(src, new Set());
      if (!map.has(tgt)) map.set(tgt, new Set());
      map.get(src)!.add(tgt);
      map.get(tgt)!.add(src);
    }
    return map;
  }, [graphData]);

  const degreeMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!graphData) return map;
    for (const edge of graphData.edges) {
      const src = typeof edge.source === "object" ? (edge.source as any).id : edge.source;
      const tgt = typeof edge.target === "object" ? (edge.target as any).id : edge.target;
      map.set(src, (map.get(src) || 0) + 1);
      map.set(tgt, (map.get(tgt) || 0) + 1);
    }
    return map;
  }, [graphData]);

  // 그래프는 최초 1회만 로드 — 이후 시대/분류/검색 필터는 서버 재조회 없이
  // 클라이언트에서 처리한다(재레이아웃·DB read 비용 제거).
  useEffect(() => {
    setLoading(true);
    fetchGraphData({}).then((data) => {
      setGraphData(data);
      setLoading(false);

      // graphData 로드 후 취약 노드 계산
      try {
        const stored = window.sessionStorage.getItem("wrongQIds");
        if (stored) {
          const wqIds = new Set<string>(JSON.parse(stored));
          const wFacts = new Set<string>();
          for (const n of data.nodes) {
            if (n.type === "fact" && (n as any).questionIds) {
              for (const qid of (n as any).questionIds) {
                if (wqIds.has(qid)) {
                  wFacts.add(n.id);
                  break;
                }
              }
            }
          }
          setWrongFactIds(wFacts);
        }
      } catch (e) {}
    });
  }, []);

  // 인과 체인 모드 활성화
  function activateCausalMode(factId: string) {
    const chain = traceCausalChain(factId, nodesRef.current, edgesRef.current);
    setCausalChainIds(new Set(chain));
    setViewMode("causal");
  }

  /* ─────── D3 Simulation & Rendering ─────── */
  useEffect(() => {
    if (!graphData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.clientWidth;
    let height = canvas.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // 전체 그래프로부터 시뮬레이션용 노드/엣지 사본 생성 (d3가 좌표를 변형).
    // 필터링은 draw 단계에서만 하므로 위치가 유지된다.
    nodesRef.current = graphData.nodes.map((d) => ({ ...d }));
    edgesRef.current = graphData.edges.map((d) => ({ ...d }));
    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    // ── 시대별 가로 밴드 배치 ──
    // 밴드 폭을 노드 수에 비례(√)시켜, 조선처럼 사건이 많은 시대는 넓게 펼쳐 밀도를 낮춘다.
    // 밴드 안에서는 연도순으로 가로 배치해 "시대 = 좌→우 연표" 구조를 만든다.
    const eraOrder = ERAS.map((e) => e.key).concat("concept");
    const eraCount = new Map<string, number>();
    const eraYMin = new Map<string, number>();
    const eraYMax = new Map<string, number>();
    for (const n of nodes as any[]) {
      const e = n.era;
      if (!e) continue;
      eraCount.set(e, (eraCount.get(e) || 0) + 1);
      if (typeof n.year === "number") {
        eraYMin.set(e, Math.min(eraYMin.get(e) ?? n.year, n.year));
        eraYMax.set(e, Math.max(eraYMax.get(e) ?? n.year, n.year));
      }
    }
    const activeEras = eraOrder.filter((k) => eraCount.has(k));
    const bandWeight = (k: string) => Math.sqrt(eraCount.get(k) || 1);
    const totalWeight = activeEras.reduce((s, k) => s + bandWeight(k), 0) || 1;
    const usableW = Math.max(width * 0.92, 300);
    const bandStart = new Map<string, number>();
    const bandW = new Map<string, number>();
    let cursorX = (width - usableW) / 2;
    for (const k of activeEras) {
      const w = (usableW * bandWeight(k)) / totalWeight;
      bandStart.set(k, cursorX);
      bandW.set(k, w);
      cursorX += w;
    }
    const targetX = (d: any): number => {
      const e = d.era as string | undefined;
      const bs = e ? bandStart.get(e) : undefined;
      if (bs === undefined) return width / 2;
      const bw = bandW.get(e!)!;
      const ymin = eraYMin.get(e!);
      const ymax = eraYMax.get(e!);
      if (typeof d.year === "number" && ymin !== undefined && ymax !== undefined && ymax > ymin) {
        // 밴드 좌우 10% 여백을 두고 연도순 위치
        return bs + bw * 0.1 + ((d.year - ymin) / (ymax - ymin)) * bw * 0.8;
      }
      return bs + bw / 2; // 연도 없는 노드는 밴드 중앙
    };

    if (simulationRef.current) simulationRef.current.stop();

    const simulation = d3.forceSimulation(nodes)
      .alphaDecay(0.05)
      .velocityDecay(0.6)
      .force("link", d3.forceLink(edges).id((d: any) => d.id).distance((d: any) => {
        if (d.type === "era-link") return 120;
        if (d.type === "relation-link") return 70;
        if (d.type === "chrono-link") return 45;
        if (d.type === "keyword-link") return 90;
        return 50;
      }).strength((d: any) => {
        if (d.type === "relation-link") return 1.2;
        if (d.type === "chrono-link") return 0.7; // 시대 내 연대순 뼈대
        return 0.4;
      }))
      .force("charge", d3.forceManyBody()
        .strength((d: any) => d.type === "era" ? -400 : -80)
        .theta(0.9))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide()
        .radius((d: any) => getRadius(d, degreeMap) + 6)
        .iterations(1))
      .force("x", d3.forceX().strength(0.07).x(targetX))
      .force("y", d3.forceY().strength(0.04).y(height / 2));

    simulationRef.current = simulation;

    function rebuildQuadtree() {
      quadtreeRef.current = d3.quadtree<any>()
        .x((d: any) => d.x)
        .y((d: any) => d.y)
        .addAll(nodes);
    }

    const draw = () => {
      ctx.save();
      ctx.clearRect(0, 0, width, height);

      const t = transformRef.current;
      ctx.translate(t.x, t.y);
      ctx.scale(t.k, t.k);

      const vx0 = -t.x / t.k, vy0 = -t.y / t.k;
      const vx1 = (width - t.x) / t.k, vy1 = (height - t.y) / t.k;
      const margin = 50;
      function inViewport(x: number, y: number) {
        return x >= vx0 - margin && x <= vx1 + margin && y >= vy0 - margin && y <= vy1 + margin;
      }

      const k = t.k;
      const hoverId = hoveredNodeIdRef.current;
      // 선택 상태는 refs로 읽는다 (시뮬레이션 재생성 없이 최신값 반영)
      const selectedFactId = selectedFactIdRef.current;
      const eraFocus = eraFocusRef.current;
      const viewMode = viewModeRef.current;
      const causalChainIds = causalChainIdsRef.current;
      const wrongFactIds = wrongFactIdsRef.current;

      // 활성 노드 셋 결정 (모드에 따라)
      let activeSet: Set<string> | null = null;
      let secondarySet: Set<string> | null = null;
      // visibleSet != null → 이 집합 밖 노드/엣지는 완전히 숨김 + 호버 차단
      let visibleSet: Set<string> | null = null;

      if (eraFocus) {
        // 시대 격리: 해당 era 노드 + 그 시대 fact만 표시, 나머지는 숨김
        visibleSet = new Set<string>([`era-${eraFocus}`]);
        for (const n of nodes) {
          if (n.type === "fact" && n.era === eraFocus) visibleSet.add(n.id);
        }
        activeSet = visibleSet;
      } else if (viewMode === "top") {
        activeSet = new Set<string>();
        for (const n of nodes) {
          if (n.type === "era" || n.importance >= 2 || (n.questionCount || 0) >= 3) {
            activeSet.add(n.id);
          }
        }
      } else if (viewMode === "weak") {
        activeSet = new Set<string>();
        for (const n of nodes) {
          if (n.type === "era" || wrongFactIds.has(n.id)) {
            activeSet.add(n.id);
          }
        }
      } else if (viewMode === "causal" && causalChainIds.size > 0) {
        // 인과 체인 모드
        activeSet = causalChainIds;
      } else if (selectedFactId) {
        // 클릭 격리: 선택 노드 + 직접 연결(1촌)만 표시, 나머지는 숨김
        visibleSet = new Set<string>([selectedFactId]);
        const neighbors = adjacencyMap.get(selectedFactId);
        if (neighbors) for (const n of neighbors) visibleSet.add(n);
        activeSet = visibleSet;
      } else if (hoverId) {
        // 클릭/격리가 없을 때만 hover 미리보기: 1촌 + 2촌 (흐림 처리)
        activeSet = new Set([hoverId]);
        secondarySet = new Set();
        const neighbors = adjacencyMap.get(hoverId);
        if (neighbors) {
          for (const n of neighbors) {
            activeSet.add(n);
            const secondNeighbors = adjacencyMap.get(n);
            if (secondNeighbors) {
              for (const sn of secondNeighbors) {
                if (sn !== hoverId) secondarySet.add(sn);
              }
            }
          }
        }
      }
      // 상단 필터(시대/분류/검색/개념)를 격리 집합과 결합 (격리 ∩ 필터).
      // 둘 다 없으면 null(전체 표시).
      const filterSet = filterVisibleRef.current;
      let hardVisible: Set<string> | null = filterSet;
      if (visibleSet) {
        if (!filterSet) {
          hardVisible = visibleSet;
        } else {
          hardVisible = new Set<string>();
          for (const id of visibleSet) if (filterSet.has(id)) hardVisible.add(id);
        }
      }
      visibleSetRef.current = hardVisible;

      // ── 엣지 렌더링 ──
      if (k >= 0.3) {
        const edgeGroups: Record<string, { links: typeof edges; color: string; width: number; dash: number[] }> = {
          "era-link":       { links: [], color: "#334155", width: 0.5, dash: [] },
          "chrono-link":    { links: [], color: "#38bdf8", width: 0.8, dash: [] },
          "relation-link":  { links: [], color: "#f87171", width: 1.5, dash: [] },
          "reference-link": { links: [], color: "#60a5fa", width: 1, dash: [4, 4] },
          "keyword-link":   { links: [], color: "#475569", width: 0.5, dash: [2, 2] },
        };

        for (const link of edges) {
          // 필터/격리 집합 밖으로 나간 엣지는 아예 그리지 않는다
          if (hardVisible && (!hardVisible.has(link.source.id) || !hardVisible.has(link.target.id))) continue;
          if (!inViewport(link.source.x, link.source.y) && !inViewport(link.target.x, link.target.y)) continue;
          const group = edgeGroups[link.type];
          if (group) group.links.push(link);
        }

        for (const [type, group] of Object.entries(edgeGroups)) {
          if (group.links.length === 0) continue;
          ctx.strokeStyle = group.color;
          ctx.lineWidth = group.width;
          ctx.setLineDash(group.dash);

          if (activeSet) {
            // 격리(visibleSet) 모드에서는 흐린 엣지를 아예 그리지 않는다.
            if (!visibleSet) {
              // 비활성 엣지
              ctx.globalAlpha = 0.03;
              ctx.beginPath();
              for (const link of group.links) {
                const srcIn = activeSet.has(link.source.id);
                const tgtIn = activeSet.has(link.target.id);
                if (srcIn && tgtIn) continue;
                if (secondarySet && ((srcIn && secondarySet.has(link.target.id)) || (secondarySet.has(link.source.id) && tgtIn))) continue;
                ctx.moveTo(link.source.x, link.source.y);
                // 곡선 처리
                const mx = (link.source.x + link.target.x) / 2;
                const my = (link.source.y + link.target.y) / 2;
                const dx = link.target.x - link.source.x;
                const dy = link.target.y - link.source.y;
                ctx.quadraticCurveTo(mx + dy * 0.1, my - dx * 0.1, link.target.x, link.target.y);
              }
              ctx.stroke();

              // 2촌 엣지
              if (secondarySet && secondarySet.size > 0) {
                ctx.globalAlpha = 0.15;
                ctx.beginPath();
                for (const link of group.links) {
                  const srcIn = activeSet.has(link.source.id);
                  const tgtIn = activeSet.has(link.target.id);
                  if (!((srcIn && secondarySet.has(link.target.id)) || (secondarySet.has(link.source.id) && tgtIn))) continue;
                  ctx.moveTo(link.source.x, link.source.y);
                  const mx = (link.source.x + link.target.x) / 2;
                  const my = (link.source.y + link.target.y) / 2;
                  const dx = link.target.x - link.source.x;
                  const dy = link.target.y - link.source.y;
                  ctx.quadraticCurveTo(mx + dy * 0.1, my - dx * 0.1, link.target.x, link.target.y);
                }
                ctx.stroke();
              }
            }

            // 1촌 / 활성 엣지 (+ 화살표)
            ctx.globalAlpha = 0.8;
            ctx.lineWidth = group.width * 1.5;
            for (const link of group.links) {
              if (!activeSet.has(link.source.id) || !activeSet.has(link.target.id)) continue;
              const r = getRadius(link.target, degreeMap);
              const dx = link.target.x - link.source.x;
              const dy = link.target.y - link.source.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len === 0) continue;
              const nx = dx / len, ny = dy / len;
              const endX = link.target.x - nx * (r + 2);
              const endY = link.target.y - ny * (r + 2);
              
              ctx.beginPath();
              ctx.moveTo(link.source.x, link.source.y);
              const mx = (link.source.x + link.target.x) / 2;
              const my = (link.source.y + link.target.y) / 2;
              const cpx = mx + dy * 0.1;
              const cpy = my - dx * 0.1;
              ctx.quadraticCurveTo(cpx, cpy, endX, endY);
              ctx.stroke();
              
              if (k >= 0.6 && (type === "relation-link" || type === "reference-link")) {
                // 곡선의 끝점 접선 방향 구하기 (approximate)
                const tx = endX - cpx;
                const ty = endY - cpy;
                const tlen = Math.sqrt(tx * tx + ty * ty);
                drawArrowHead(ctx, endX, endY, tx / tlen, ty / tlen, 5);
                ctx.stroke();
              }
            }
          } else {
            ctx.globalAlpha = 0.1;
            ctx.beginPath();
            for (const link of group.links) {
              ctx.moveTo(link.source.x, link.source.y);
              const mx = (link.source.x + link.target.x) / 2;
              const my = (link.source.y + link.target.y) / 2;
              const dx = link.target.x - link.source.x;
              const dy = link.target.y - link.source.y;
              ctx.quadraticCurveTo(mx + dy * 0.1, my - dx * 0.1, link.target.x, link.target.y);
            }
            ctx.stroke();
          }
        }
      }
      ctx.setLineDash([]);

      // ── 노드 렌더링 ──
      for (const node of nodes) {
        // 격리/필터 모드: 집합 밖 노드는 완전히 숨김
        if (hardVisible && !hardVisible.has(node.id)) continue;
        if (!inViewport(node.x, node.y)) continue;
        const isHovered = node.id === hoveredNodeIdRef.current;
        const isSelected = node.id === selectedFactId;
        const r = getRadius(node, degreeMap);

        let nodeAlpha = 1.0;
        if (activeSet) {
          if (activeSet.has(node.id)) nodeAlpha = 1.0;
          else if (secondarySet?.has(node.id)) nodeAlpha = 0.3;
          else nodeAlpha = 0.06;
        }

        ctx.globalAlpha = nodeAlpha;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        
        const baseColor = getColor(node);
        const grad = ctx.createRadialGradient(node.x - r * 0.3, node.y - r * 0.3, r * 0.1, node.x, node.y, r);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, baseColor);
        grad.addColorStop(1, baseColor);
        ctx.fillStyle = grad;

        const needsGlow = isHovered || isSelected || (activeSet && activeSet.has(node.id));
        if (needsGlow) {
          ctx.shadowColor = baseColor;
          ctx.shadowBlur = (isHovered || isSelected) ? 20 : 10;
        } else {
          ctx.shadowBlur = 0;
        }

        ctx.fill();
        ctx.shadowBlur = 0; // reset for strokes

        // 빈출 노드 강조 링
        if (node.type === "fact" && (node.questionCount || 0) >= 3 && !activeSet) {
          ctx.lineWidth = 2;
          ctx.strokeStyle = "rgba(251,191,36,0.6)"; // amber glow
          ctx.stroke();
        }

        // 취약 노드 (틀린 기출 연결) 강조 링 (최우선)
        if (node.type === "fact" && wrongFactIds.has(node.id) && (!activeSet || activeSet.has(node.id))) {
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = "rgba(239,68,68,0.85)"; // red
          ctx.stroke();
        }

        if (isHovered || isSelected) {
          ctx.lineWidth = 3;
          ctx.strokeStyle = "#f8fafc";
          ctx.stroke();
          // 선택된 노드에 기출 수 뱃지
          if (node.type === "fact" && (node.questionCount || 0) > 0) {
            const badgeX = node.x + r * 0.7;
            const badgeY = node.y - r * 0.7;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, 8, 0, 2 * Math.PI);
            ctx.fillStyle = "#3b82f6";
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "bold 9px sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(node.questionCount), badgeX, badgeY);
          }
        } else if (node.type === "era") {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.stroke();
        }

        // 텍스트 라벨
        const isActiveNode = nodeAlpha >= 0.9;
        const showLabel =
          (isActiveNode && activeSet !== null) ||
          k > 2.0 ||
          node.type === "era" ||
          (k > 1.0 && node.importance >= 2);

        if (showLabel && isActiveNode) {
          ctx.globalAlpha = nodeAlpha;
          ctx.font = (node.type === "era" || isHovered || isSelected)
            ? "bold 12px 'Pretendard', sans-serif"
            : "11px 'Pretendard', sans-serif";
          ctx.fillStyle = "#e2e8f0";
          ctx.strokeStyle = "rgba(15,23,42,0.85)";
          ctx.lineWidth = 3;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.strokeText(node.label, node.x, node.y + r + 11);
          ctx.fillText(node.label, node.x, node.y + r + 11);
        }
      }

      ctx.restore();
    };
    drawRef.current = draw;

    simulation.on("tick", () => {
      // 노드가 움직이는 동안(alpha 높음)에만 quadtree 재구축.
      // 안정화되면 매 프레임 재구축은 낭비이므로 정지 직전 1회만 갱신.
      if (simulation.alpha() > 0.05) rebuildQuadtree();
      draw();
      if (simulation.alpha() < 0.01) {
        rebuildQuadtree();
        simulation.stop();
      }
    });

    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 5])
      .on("zoom", (e) => {
        transformRef.current = e.transform;
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(draw);
      });

    // 지정한 노드 집합이 화면 가운데 꽉 차도록 줌/팬 (부드러운 전환)
    fitRef.current = (ids: Set<string>) => {
      const pts = nodes.filter(
        (n: any) => ids.has(n.id) && Number.isFinite(n.x) && Number.isFinite(n.y)
      );
      if (pts.length === 0) return;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of pts) {
        const r = getRadius(n, degreeMap) + 14;
        minX = Math.min(minX, n.x - r);
        minY = Math.min(minY, n.y - r);
        maxX = Math.max(maxX, n.x + r);
        maxY = Math.max(maxY, n.y + r);
      }
      const w = Math.max(maxX - minX, 1);
      const h = Math.max(maxY - minY, 1);
      const pad = 120;
      // 과도한 확대 방지(최대 1.6배), scaleExtent 범위로 클램프
      const scale = Math.min(1.6, Math.max(0.1, Math.min((width - pad) / w, (height - pad) / h)));
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
      const transform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(scale)
        .translate(-cx, -cy);
      d3.select(canvas).transition().duration(600).call(zoom.transform, transform);
    };

    // 초기 줌아웃 설정 (데이터 로드 시 1회)
    const initialTransform = d3.zoomIdentity.translate(width / 2, height / 2).scale(0.25).translate(-width / 2, -height / 2);
    d3.select(canvas).call(zoom).call(zoom.transform, initialTransform);

    let lastMouseX = 0, lastMouseY = 0;
    let hoverRafPending = false;

    d3.select(canvas)
      .on("mousemove", (e) => {
        lastMouseX = e.offsetX;
        lastMouseY = e.offsetY;
        if (!hoverRafPending) {
          hoverRafPending = true;
          requestAnimationFrame(() => {
            hoverRafPending = false;
            const tr = transformRef.current;
            const x = tr.invertX(lastMouseX);
            const y = tr.invertY(lastMouseY);
            let closest: any = null;
            if (quadtreeRef.current) {
              closest = quadtreeRef.current.find(x, y, 30 / tr.k) ?? null;
            }
            // 격리 모드: 숨겨진 노드는 호버/툴팁 대상에서 제외
            if (closest && visibleSetRef.current && !visibleSetRef.current.has(closest.id)) {
              closest = null;
            }
            const newHoverId = closest ? closest.id : null;
            if (hoveredNodeIdRef.current !== newHoverId) {
              hoveredNodeIdRef.current = newHoverId;
              hoveredNodeRef.current = closest;
              canvas.style.cursor = closest ? "pointer" : "grab";
              // Tooltip 업데이트
              updateTooltip(closest, lastMouseX, lastMouseY);
              if (simulation.alpha() < 0.05) draw();
            }
          });
        }
      })
      .on("mouseout", () => {
        if (hoveredNodeIdRef.current !== null) {
          hoveredNodeIdRef.current = null;
          hoveredNodeRef.current = null;
          updateTooltip(null, 0, 0);
          if (simulation.alpha() < 0.05) draw();
        }
      })
      .on("click", () => {
        const clickedId = hoveredNodeIdRef.current;
        if (clickedId) {
          const clickedNode = nodes.find((n: any) => n.id === clickedId);
          if (clickedNode?.type === "era") {
            // 시대 노드 클릭 → 해당 시대 관계망만 격리(토글)
            const eraKey = clickedId.replace(/^era-/, "");
            setEraFocus((cur) => (cur === eraKey ? null : eraKey));
            setSelectedFactId(null);
            setViewMode("all");
            setCausalChainIds(new Set());
            router.replace(`/network`, { scroll: false });
          } else if (clickedNode?.type === "fact") {
            setEraFocus(null); // 사건 클릭 시 시대 격리 해제
            setSelectedFactId(clickedId);
            router.replace(`?factId=${clickedId}`, { scroll: false });
            // 인과 체인 모드였으면 해당 사건 기준으로 체인 갱신
            if (viewModeRef.current === "causal") {
              activateCausalMode(clickedId);
            }
          }
        } else {
          setSelectedFactId(null);
          setViewMode("all");
          setCausalChainIds(new Set());
          setEraFocus(null);
          router.replace(`/network`, { scroll: false });
        }
      });

    // 창/패널 크기 변화 대응 — 좌표계·중심력 재설정 후 살짝 재가열 (디바운스)
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    function handleResize() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h || (w === width && h === height)) return;
      width = w;
      height = h;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx!.scale(dpr, dpr); // canvas.width 재설정으로 초기화된 변환 복원
      const centerForce = simulation.force("center") as d3.ForceCenter<any> | undefined;
      if (centerForce) centerForce.x(width / 2).y(height / 2);
      const yForce = simulation.force("y") as d3.ForceY<any> | undefined;
      if (yForce) yForce.y(height / 2);
      simulation.alpha(0.2).restart();
      draw();
    }
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 150);
    }
    window.addEventListener("resize", onResize);

    return () => {
      simulation.stop();
      cancelAnimationFrame(rafIdRef.current);
      window.removeEventListener("resize", onResize);
      if (resizeTimer) clearTimeout(resizeTimer);
      drawRef.current = null;
      fitRef.current = null;
    };
    // 선택 상태(selectedFactId/eraFocus/viewMode/causalChainIds/filter)는 refs로 읽으므로
    // deps에서 제외 → 클릭·필터 변경 시 시뮬레이션이 재생성되지 않고 줌이 유지됨
  }, [graphData, adjacencyMap, degreeMap, router]);

  // 선택/모드/필터 변경 시 리레이아웃 없이 다시 그리기
  useEffect(() => {
    drawRef.current?.();
  }, [selectedFactId, eraFocus, viewMode, causalChainIds, wrongFactIds, filterVisible]);

  // 사건/시대 선택 시 해당 관계망을 화면 가운데 꽉 차게 줌-핏
  useEffect(() => {
    if (!fitRef.current) return;
    let ids: Set<string> | null = null;
    if (eraFocus) {
      ids = new Set<string>([`era-${eraFocus}`]);
      for (const n of nodesRef.current) {
        if (n.type === "fact" && n.era === eraFocus) ids.add(n.id);
      }
    } else if (selectedFactId) {
      ids = new Set<string>([selectedFactId]);
      const nb = adjacencyMap.get(selectedFactId);
      if (nb) for (const n of nb) ids.add(n);
    } else if (filterVisible && filterVisible.size > 0) {
      // 상단 필터(시대/분류/검색)만 걸린 상태 → 결과 집합이 화면에 꽉 차게
      ids = filterVisible;
    }
    if (ids && ids.size > 0) {
      // 시뮬레이션이 위치를 잡을 시간을 살짝 준 뒤 핏
      const timer = setTimeout(() => fitRef.current?.(ids!), 120);
      return () => clearTimeout(timer);
    }
  }, [selectedFactId, eraFocus, adjacencyMap, filterVisible]);

  // ── Phase A: Tooltip ──
  function updateTooltip(node: any, mouseX: number, mouseY: number) {
    const el = tooltipRef.current;
    if (!el) return;
    if (!node || node.type === "era") {
      el.style.display = "none";
      return;
    }
    el.style.display = "block";
    // 위치: 마우스 오른쪽 아래
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    if (!canvasRect) return;
    let left = mouseX + 16;
    let top = mouseY + 16;
    // 화면 밖 방지
    if (left + 260 > canvasRect.width) left = mouseX - 270;
    if (top + 120 > canvasRect.height) top = mouseY - 130;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;

    const eraName = eraDisplayLabel(node.era) || "";
    const yearStr = node.year ? (node.year > 0 ? `${node.year}년` : `BC ${-node.year}년`) : "";
    const stars = node.importance ? "★".repeat(node.importance) : "";
    const qCount = node.questionCount || 0;
    const neighborCount = adjacencyMap.get(node.id)?.size || 0;
    const kwStr = (node.keywords || []).slice(0, 4).join(", ");

    el.innerHTML = `
      <div style="font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:4px;">${node.label}</div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">${eraName} ${yearStr} ${stars ? `· ${stars}` : ""} ${node.category ? `· ${node.category}` : ""}</div>
      <div style="border-top:1px solid #334155;padding-top:6px;font-size:11px;color:#cbd5e1;space-y:2px;">
        ${qCount > 0 ? `<div>📝 기출 연결: <span style="color:#60a5fa;font-weight:600;">${qCount}문항</span></div>` : ""}
        <div>🔗 연결 사건: ${neighborCount}개</div>
        ${kwStr ? `<div>📌 키워드: ${kwStr}</div>` : ""}
      </div>
      <div style="margin-top:6px;font-size:10px;color:#64748b;">클릭하여 상세 보기 →</div>
    `;
  }

  function drawArrowHead(ctx: CanvasRenderingContext2D, x: number, y: number, nx: number, ny: number, size: number) {
    const angle = Math.PI / 6;
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * (nx * Math.cos(angle) - ny * Math.sin(angle)), y - size * (nx * Math.sin(angle) + ny * Math.cos(angle)));
    ctx.moveTo(x, y);
    ctx.lineTo(x - size * (nx * Math.cos(-angle) - ny * Math.sin(-angle)), y - size * (nx * Math.sin(-angle) + ny * Math.cos(-angle)));
  }

  const selectedFact = selectedFactId ? factMap.get(selectedFactId) : null;

  return (
    <div className="flex h-[calc(100vh-140px)] w-full flex-col md:flex-row overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Graph Area */}
      <div className="relative flex-1 bg-[#0f172a] flex flex-col">
        {/* Toolbar */}
        <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-56 shadow-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="사건, 키워드 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border border-slate-700 bg-slate-800/80 text-slate-200 py-2 pl-9 pr-4 text-sm outline-none focus:border-blue-500 placeholder:text-slate-500 backdrop-blur-sm"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1 bg-slate-800/80 p-1 rounded-full border border-slate-700 shadow-sm backdrop-blur-sm max-w-full overflow-x-auto flex-nowrap">
            <button onClick={() => setEra("")} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${era === "" ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"}`}>전체</button>
            {ERAS.map(e => (
              <button key={e.key} onClick={() => setEra(era === e.key ? "" : e.key)} className="px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap" style={era === e.key ? { backgroundColor: e.color, color: "#fff" } : { color: e.color }}>
                {e.label}
              </button>
            ))}
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-full border border-slate-700 bg-slate-800/80 text-slate-200 px-3 py-1.5 text-sm shadow-sm outline-none backdrop-blur-sm"
          >
            <option value="">모든 분류</option>
            {FACT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-blue-400" size={32} />
              <span className="text-sm text-slate-300">지식 그래프 구성 중...</span>
            </div>
          </div>
        )}

        {/* 시대 격리 인디케이터 */}
        {eraFocus && (
          <div className="absolute left-1/2 top-16 z-20 -translate-x-1/2">
            <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-4 py-1.5 text-xs text-slate-200 shadow-lg backdrop-blur-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: eraFocus === "concept" ? "#a78bfa" : (ERAS.find(e => e.key === eraFocus)?.color || "#94a3b8") }} />
              <span className="font-semibold">{eraDisplayLabel(eraFocus)}</span> 관계망만 표시 중
              <button onClick={() => setEraFocus(null)} className="ml-1 rounded-full p-0.5 text-slate-400 hover:bg-slate-700 hover:text-white">
                <X size={13} />
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="h-full w-full outline-none cursor-grab active:cursor-grabbing" />

        {/* Phase A: Hover Tooltip (HTML Overlay) */}
        <div
          ref={tooltipRef}
          className="absolute z-20 pointer-events-none"
          style={{
            display: "none",
            maxWidth: 260,
            background: "rgba(15,23,42,0.95)",
            borderRadius: 10,
            padding: "10px 14px",
            border: "1px solid #334155",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        />

        {/* Phase E: Quick Access Bar */}
        <div className="absolute bottom-4 right-4 z-10 flex gap-2">
          <button
            onClick={() => setShowConcepts((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${showConcepts ? "bg-violet-500/90 text-white shadow-lg shadow-violet-500/30" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700"} backdrop-blur-sm`}
            title="문항별 학습 개념(암기 팁·오답 노트) 노드 표시/숨김"
          >
            <BookOpen size={14} />
            학습 개념 {showConcepts ? "ON" : "OFF"}
          </button>
          <button
            onClick={() => setViewMode(viewMode === "weak" ? "all" : "weak")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === "weak" ? "bg-red-500/90 text-white shadow-lg shadow-red-500/30" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700"} backdrop-blur-sm`}
          >
            <AlertCircle size={14} />
            내 취약점 ({wrongFactIds.size})
          </button>
          <button
            onClick={() => setViewMode(viewMode === "top" ? "all" : "top")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === "top" ? "bg-amber-500/90 text-white shadow-lg shadow-amber-500/30" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700"} backdrop-blur-sm`}
          >
            <Flame size={14} />
            빈출 TOP
          </button>
          <button
            disabled={!selectedFactId && viewMode !== "causal"}
            onClick={() => {
              if (viewMode === "causal") {
                setViewMode("all");
                setCausalChainIds(new Set());
              } else if (selectedFactId) {
                activateCausalMode(selectedFactId);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${viewMode === "causal" ? "bg-indigo-500/90 text-white shadow-lg shadow-indigo-500/30" : "bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700"} backdrop-blur-sm disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-800/80`}
            title={selectedFactId || viewMode === "causal" ? "선택한 사건의 인과 체인 추적" : "사건을 먼저 클릭하세요"}
          >
            <GitBranch size={14} />
            인과 추적
          </button>
        </div>

        {/* 범례 */}
        <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-slate-900/80 p-3 rounded-lg shadow-lg border border-slate-700/50 space-y-1.5 backdrop-blur-md">
          <div className="font-semibold text-slate-200 mb-1 border-b border-slate-700 pb-1">Graph View</div>
          <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full bg-slate-400" /> 시대</div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full" style={{ background: "conic-gradient(from 0deg, #f59e0b, #10b981, #3b82f6, #8b5cf6, #f59e0b)" }} /> 사건 <span className="text-slate-500">(색=시대별)</span>
          </div>
          {showConcepts && (
            <div className="flex items-center gap-1.5"><span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: "#a78bfa" }} /> 학습 개념</div>
          )}
          <div className="mt-1 pt-1 border-t border-slate-700 flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5 bg-red-400" /> 인과관계
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-0.5" style={{ backgroundColor: "#38bdf8" }} /> 시대 흐름(연대순)
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-400 bg-transparent" /> 빈출 3+
          </div>
          <div className="flex items-center gap-1.5 text-red-300">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-red-500 bg-transparent" /> 오답 이력
          </div>
        </div>

        {/* Onboarding / Filter Modal */}
        {showOnboarding && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-surface/90 border border-white/10 p-8 rounded-2xl shadow-2xl max-w-lg w-full text-center relative">
              <h2 className="text-2xl font-bold mb-2 text-foreground">한국사 마스터 관계망</h2>
              <p className="text-muted-foreground mb-8">방대한 한국사의 흐름을 어떻게 탐색하시겠습니까?</p>
              
              {onboardingStep === 1 && (
                <div className="grid grid-cols-3 gap-4">
                  <button onClick={() => { setOnboardingType("era"); setOnboardingStep(2); }} className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/10 transition text-foreground font-semibold">시대별</button>
                  <button onClick={() => { setOnboardingType("category"); setOnboardingStep(2); }} className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/10 transition text-foreground font-semibold">사건별</button>
                  <button onClick={() => { setOnboardingType("person"); setOnboardingStep(2); }} className="p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/10 transition text-foreground font-semibold">인물별</button>
                </div>
              )}
              
              {onboardingStep === 2 && onboardingType === "era" && (
                <div className="grid grid-cols-3 gap-2">
                  {ERAS.map(e => (
                    <button key={e.key} onClick={() => { setEra(e.key); closeOnboarding(); }} className="p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition text-sm text-foreground">{e.label}</button>
                  ))}
                </div>
              )}
              
              {onboardingStep === 2 && onboardingType === "category" && (
                <div className="grid grid-cols-3 gap-2">
                  {FACT_CATEGORIES.map(c => (
                    <button key={c} onClick={() => { setCategory(c); closeOnboarding(); }} className="p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition text-sm text-foreground">{c}</button>
                  ))}
                </div>
              )}
              
              {onboardingStep === 2 && onboardingType === "person" && (
                <div className="grid grid-cols-3 gap-2">
                  {["고국원왕", "장수왕", "진흥왕", "의자왕", "왕건", "광종", "공민왕", "이성계", "세종", "이순신", "정조", "흥선대원군"].map(p => (
                    <button key={p} onClick={() => { setQuery(p); closeOnboarding(); }} className="p-2 rounded-lg border border-border hover:border-primary/50 hover:bg-primary/10 transition text-sm text-foreground">{p}</button>
                  ))}
                </div>
              )}

              {onboardingStep === 2 && (
                <button onClick={() => setOnboardingStep(1)} className="mt-6 text-sm text-muted-foreground hover:text-foreground">← 뒤로 가기</button>
              )}
              
              <button onClick={closeOnboarding} className="absolute top-4 right-4 text-muted hover:text-foreground p-1">
                <X size={20} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Wiki Panel */}
      {selectedFact && (
        <div className="fixed inset-x-0 bottom-0 z-40 h-[72vh] w-full rounded-t-2xl border-t bg-white shadow-2xl transition-all duration-300 md:static md:h-full md:w-[400px] lg:w-[480px] md:rounded-none md:border-l md:border-t-0 md:shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.1)] flex-shrink-0">
          <WikiPanel
            fact={selectedFact}
            factMap={factMap}
            onClose={() => {
              setSelectedFactId(null);
              setViewMode("all");
              setCausalChainIds(new Set());
              router.replace(`/network`, { scroll: false });
            }}
            onNavigate={(id) => {
              setSelectedFactId(id);
              router.replace(`?factId=${id}`, { scroll: false });
              if (viewMode === "causal") activateCausalMode(id);
            }}
            onKeywordClick={(kw) => setQuery(kw)}
          />
        </div>
      )}
    </div>
  );
}

export default function NetworkPageWrapper() {
  return (
    <div className="p-4">
      <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>}>
        <NetworkPage />
      </Suspense>
    </div>
  );
}
