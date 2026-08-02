"use client";

import { useEffect, useMemo, useState, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { fetchFacts, fetchGraphData, type GraphFilter } from "@/lib/api";
import { ERAS, FACT_CATEGORIES } from "@/lib/domain";
import { buildFactMap } from "@/lib/network";
import type { FactDTO } from "@/lib/types";
import type { GraphData, GraphNode, GraphEdge } from "@/lib/network";
import { Loader2, Search, X } from "lucide-react";
import WikiPanel from "@/components/WikiPanel";
import * as d3 from "d3";

function NetworkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFactId = searchParams.get("factId");

  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [era, setEra] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [query, setQuery] = useState<string>("");
  const [debouncedQuery, setDebouncedQuery] = useState<string>("");

  const [selectedFactId, setSelectedFactId] = useState<string | null>(initialFactId);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<d3.Simulation<d3.SimulationNodeDatum, undefined> | null>(null);
  const transformRef = useRef<d3.ZoomTransform>(d3.zoomIdentity);
  const nodesRef = useRef<any[]>([]);
  const edgesRef = useRef<any[]>([]);

  // 1. Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  // 2. Fetch Facts for factMap
  useEffect(() => {
    fetchFacts().then((f) => setFacts(f));
  }, []);

  const factMap = useMemo(() => buildFactMap(facts), [facts]);

  // 3. Fetch Graph Data
  useEffect(() => {
    setLoading(true);
    const filter: GraphFilter = { era, category, q: debouncedQuery };
    fetchGraphData(filter).then((data) => {
      // D3 modifies nodes and edges in place, so we make a deep copy for the simulation
      nodesRef.current = data.nodes.map(d => ({ ...d }));
      edgesRef.current = data.edges.map(d => ({ ...d }));
      setGraphData(data);
      setLoading(false);
    });
  }, [era, category, debouncedQuery]);

  // 4. D3 Simulation & Rendering
  useEffect(() => {
    if (!graphData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    // Set actual canvas resolution based on device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const nodes = nodesRef.current;
    const edges = edgesRef.current;

    // Simulation
    if (simulationRef.current) simulationRef.current.stop();
    
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(edges).id((d: any) => d.id).distance((d: any) => d.type === "era-link" ? 150 : 50))
      .force("charge", d3.forceManyBody().strength(-100))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius((d: any) => getRadius(d) + 5));

    simulationRef.current = simulation;

    // Render loop
    simulation.on("tick", () => {
      ctx.save();
      ctx.clearRect(0, 0, width, height);
      ctx.translate(transformRef.current.x, transformRef.current.y);
      ctx.scale(transformRef.current.k, transformRef.current.k);

      // Draw edges
      ctx.globalAlpha = 0.6;
      for (const link of edges) {
        ctx.beginPath();
        ctx.moveTo(link.source.x, link.source.y);
        ctx.lineTo(link.target.x, link.target.y);
        ctx.strokeStyle = link.type === "era-link" ? "#e2e8f0" : "#cbd5e1";
        ctx.lineWidth = link.type === "era-link" ? 2 : 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;

      // Draw nodes
      for (const node of nodes) {
        const isSelected = node.id === selectedFactId;
        const r = getRadius(node);

        ctx.beginPath();
        if (node.type === "keyword") {
          // Diamond
          ctx.moveTo(node.x, node.y - r);
          ctx.lineTo(node.x + r, node.y);
          ctx.lineTo(node.x, node.y + r);
          ctx.lineTo(node.x - r, node.y);
        } else {
          // Circle
          ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
        }
        
        ctx.fillStyle = getColor(node, isSelected);
        ctx.fill();
        
        if (isSelected || node.type === "era") {
          ctx.lineWidth = isSelected ? 3 : 2;
          ctx.strokeStyle = isSelected ? "#0f172a" : "#fff";
          ctx.stroke();
        }

        // Labels
        if (node.type === "era" || node.importance === 3 || isSelected) {
          ctx.font = node.type === "era" ? "bold 14px sans-serif" : "11px sans-serif";
          ctx.fillStyle = "#334155";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(node.label, node.x, node.y + r + 12);
        }
      }
      ctx.restore();
    });

    // Zoom
    const zoom = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (e) => {
        transformRef.current = e.transform;
        simulation.alpha(0.1).restart();
      });
    
    d3.select(canvas).call(zoom);

    // Click detection
    d3.select(canvas).on("click", (e) => {
      const transform = transformRef.current;
      const x = transform.invertX(e.offsetX);
      const y = transform.invertY(e.offsetY);

      // Find closest node
      let closest: any = null;
      let minDst = Infinity;
      for (const node of nodes) {
        const dx = node.x - x;
        const dy = node.y - y;
        const dst = dx * dx + dy * dy;
        const r = getRadius(node);
        if (dst < r * r * 2 && dst < minDst) { // Some tolerance
          closest = node;
          minDst = dst;
        }
      }

      if (closest) {
        if (closest.type === "fact") {
          setSelectedFactId(closest.id);
          router.replace(`?factId=${closest.id}`, { scroll: false });
        } else if (closest.type === "keyword") {
          setQuery(closest.label);
        }
      } else {
        setSelectedFactId(null);
        router.replace(`/network`, { scroll: false });
      }
    });

    return () => {
      simulation.stop();
    };
  }, [graphData, selectedFactId, router]);

  function getRadius(node: any) {
    if (node.type === "era") return 24;
    if (node.type === "keyword") return 6;
    if (node.importance === 3) return 14;
    if (node.importance === 2) return 10;
    return 6;
  }

  function getColor(node: any, isSelected: boolean) {
    if (node.type === "keyword") return isSelected ? "#64748b" : "#e2e8f0";
    if (node.type === "era") return node.color || "#94a3b8";
    
    // Fact node uses Era color
    const eraColorHex = ERAS.find(e => e.key === node.era)?.color || "#94a3b8";
    return eraColorHex;
  }

  const selectedFact = selectedFactId ? factMap.get(selectedFactId) : null;

  return (
    <div className="flex h-[calc(100vh-140px)] w-full flex-col md:flex-row overflow-hidden rounded-xl border bg-background shadow-sm">
      {/* Graph Area */}
      <div className="relative flex-1 bg-slate-50/50 flex flex-col">
        {/* Toolbar */}
        <div className="absolute left-4 right-4 top-4 z-10 flex flex-wrap items-center gap-3">
          <div className="relative w-64 shadow-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text"
              placeholder="연표, 키워드 검색..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-full border bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-primary"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-1 bg-white p-1 rounded-full border shadow-sm">
            <button onClick={() => setEra("")} className={`px-3 py-1 rounded-full text-xs font-medium ${era === "" ? "bg-slate-800 text-white" : "text-muted-foreground hover:bg-slate-100"}`}>전체 시대</button>
            {ERAS.map(e => (
              <button key={e.key} onClick={() => setEra(era === e.key ? "" : e.key)} className={`px-3 py-1 rounded-full text-xs font-medium transition-colors`} style={era === e.key ? { backgroundColor: e.color, color: "#fff" } : { color: e.color }}>
                {e.label}
              </button>
            ))}
          </div>
          <select 
            value={category} 
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-full border bg-white px-3 py-1.5 text-sm shadow-sm outline-none"
          >
            <option value="">모든 분류</option>
            {FACT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="animate-spin text-primary" size={32} />
              <span className="text-sm text-muted-foreground">지식 그래프 구성 중...</span>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="h-full w-full outline-none cursor-grab active:cursor-grabbing" />
        
        <div className="absolute bottom-4 left-4 text-xs text-muted-foreground bg-white/80 p-2 rounded border">
          • 마우스 드래그 및 휠(줌)로 탐색<br/>
          • 큰 원: 시대 / 색상 원: 사건 / 다이아몬드: 키워드
        </div>
      </div>

      {/* Slide-over Wiki Panel */}
      {selectedFact && (
        <div className="w-full md:w-[400px] lg:w-[480px] h-full flex-shrink-0 bg-white transition-all duration-300 border-l">
          <WikiPanel 
            fact={selectedFact} 
            factMap={factMap} 
            onClose={() => {
              setSelectedFactId(null);
              router.replace(`/network`, { scroll: false });
            }}
            onNavigate={(id) => {
              setSelectedFactId(id);
              router.replace(`?factId=${id}`, { scroll: false });
            }}
            onKeywordClick={(kw) => {
              setQuery(kw);
            }}
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
