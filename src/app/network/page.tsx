"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchFacts } from "@/lib/api";
import { eraColor, eraLabel } from "@/lib/domain";
import type { FactDTO } from "@/lib/types";
import { Loader2, Network as NetIcon } from "lucide-react";

interface Node { id: string; era: string | null; x: number; y: number; vx: number; vy: number; body?: string }
interface Edge { a: string; b: string }

const W = 800;
const H = 560;

export default function NetworkPage() {
  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    fetchFacts().then((f) => { setFacts(f); setLoading(false); });
  }, []);

  // 그래프 구성 + 힘 기반 레이아웃
  useEffect(() => {
    if (facts.length === 0) return;

    const nodeMap = new Map<string, Node>();
    const eraOf = new Map<string, string>();
    facts.forEach((f) => eraOf.set(f.title, f.era));

    function ensure(id: string) {
      if (!nodeMap.has(id)) {
        const i = nodeMap.size;
        // 원형 초기 배치 (결정적)
        const ang = (i * 2.399963); // 황금각
        const r = 40 + i * 6;
        nodeMap.set(id, {
          id,
          era: eraOf.get(id) ?? null,
          x: W / 2 + Math.cos(ang) * r * 0.5,
          y: H / 2 + Math.sin(ang) * r * 0.5,
          vx: 0, vy: 0,
        });
      }
      return nodeMap.get(id)!;
    }

    const es: Edge[] = [];
    facts.forEach((f) => {
      const n = ensure(f.title);
      n.body = f.body;
      f.relatedTo.forEach((r) => {
        ensure(r);
        es.push({ a: f.title, b: r });
      });
    });

    const ns = [...nodeMap.values()];

    // 간단한 스프링/반발 시뮬레이션
    for (let iter = 0; iter < 220; iter++) {
      // 반발력
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[i].x - ns[j].x;
          const dy = ns[i].y - ns[j].y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) d2 = 1;
          const force = 1400 / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * force;
          const fy = (dy / d) * force;
          ns[i].vx += fx; ns[i].vy += fy;
          ns[j].vx -= fx; ns[j].vy -= fy;
        }
      }
      // 스프링(엣지)
      for (const e of es) {
        const a = nodeMap.get(e.a)!, b = nodeMap.get(e.b)!;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 1;
        const k = (d - 90) * 0.02;
        const fx = (dx / d) * k, fy = (dy / d) * k;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }
      // 중심 인력 + 감쇠 + 위치 갱신
      for (const n of ns) {
        n.vx += (W / 2 - n.x) * 0.005;
        n.vy += (H / 2 - n.y) * 0.005;
        n.vx *= 0.85; n.vy *= 0.85;
        n.x += n.vx; n.y += n.vy;
        n.x = Math.max(30, Math.min(W - 30, n.x));
        n.y = Math.max(30, Math.min(H - 30, n.y));
      }
    }

    setNodes(ns);
    setEdges(es);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [facts]);

  const neighbors = useMemo(() => {
    if (!active) return new Set<string>();
    const s = new Set<string>([active]);
    edges.forEach((e) => {
      if (e.a === active) s.add(e.b);
      if (e.b === active) s.add(e.a);
    });
    return s;
  }, [active, edges]);

  const activeNode = nodes.find((n) => n.id === active);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><NetIcon className="text-primary" /> 인물 · 사건 관계망</h1>
        <p className="text-muted">사건·인물·제도의 연결을 시각화합니다. 노드를 눌러 관계를 확인하세요.</p>
      </header>

      {loading ? (
        <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted" /></div>
      ) : (
        <div className="card overflow-hidden p-2">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ touchAction: "none" }}>
            {edges.map((e, i) => {
              const a = nodes.find((n) => n.id === e.a);
              const b = nodes.find((n) => n.id === e.b);
              if (!a || !b) return null;
              const hot = active && (neighbors.has(e.a) && neighbors.has(e.b));
              return (
                <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={hot ? "var(--primary)" : "var(--border)"}
                  strokeWidth={hot ? 2 : 1} opacity={active && !hot ? 0.15 : 0.6} />
              );
            })}
            {nodes.map((n) => {
              const dim = active && !neighbors.has(n.id);
              const isActive = n.id === active;
              const color = n.era ? eraColor(n.era) : "#94a3b8";
              return (
                <g key={n.id} onClick={() => setActive(isActive ? null : n.id)} style={{ cursor: "pointer" }} opacity={dim ? 0.25 : 1}>
                  <circle cx={n.x} cy={n.y} r={isActive ? 9 : 6} fill={color} stroke={isActive ? "var(--foreground)" : "white"} strokeWidth={isActive ? 2 : 1} />
                  <text x={n.x} y={n.y - 11} textAnchor="middle" fontSize={11} fill="var(--foreground)" style={{ pointerEvents: "none" }}>
                    {n.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {activeNode && (
        <div className="card p-4">
          <div className="mb-1 flex items-center gap-2">
            {activeNode.era && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: eraColor(activeNode.era) }}>
                {eraLabel(activeNode.era)}
              </span>
            )}
            <h3 className="font-bold">{activeNode.id}</h3>
          </div>
          <p className="text-sm leading-relaxed text-muted">{activeNode.body ?? "연결된 키워드입니다."}</p>
        </div>
      )}
    </div>
  );
}
