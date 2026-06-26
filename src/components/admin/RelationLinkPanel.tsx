"use client";

import { useState } from "react";
import { useUI } from "@/components/ui/UIProvider";
import { Loader2, Share2, ListPlus } from "lucide-react";

/** 관리자 전용: Claude로 연표 보강 — 이전/이후 관계망 + 상세설명 일괄 생성 */
export default function RelationLinkPanel() {
  return (
    <div className="space-y-4">
      <RelationSection />
      <DetailSection />
    </div>
  );
}

function RelationSection() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ processed: number; linked: number } | null>(null);

  async function run(mode: "missing" | "all") {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/link-relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "실패");
      setResult(d);
      toast(`${d.processed}항목 처리, ${d.linked}개 관계 생성`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "생성 실패", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm font-medium">① 이전·이후 관계망</p>
      <p className="text-sm text-muted">Claude로 각 연표 항목의 이전(배경·원인)·이후(결과·영향) 관계를 생성합니다.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary px-4 py-2" onClick={() => run("missing")} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />} 미생성 관계 생성
        </button>
        <button className="btn btn-outline px-4 py-2" onClick={() => run("all")} disabled={busy}>전체 재생성</button>
      </div>
      {result && <p className="text-sm">처리 {result.processed}항목 · 관계 {result.linked}개</p>}
    </div>
  );
}

function DetailSection() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ processed: number; written: number } | null>(null);

  async function run(mode: "missing" | "all") {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/generate-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "실패");
      setResult(d);
      toast(`${d.processed}항목 처리, ${d.written}개 상세설명 생성`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "생성 실패", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm font-medium">② 상세 설명(단문)</p>
      <p className="text-sm text-muted">각 연표 항목의 상세 설명을 짧은 단문(불릿)으로 생성합니다. 연표 상세에서 요약 아래에 표시됩니다.</p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary px-4 py-2" onClick={() => run("missing")} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <ListPlus size={16} />} 미생성 상세설명 생성
        </button>
        <button className="btn btn-outline px-4 py-2" onClick={() => run("all")} disabled={busy}>전체 재생성</button>
      </div>
      {result && <p className="text-sm">처리 {result.processed}항목 · 상세설명 {result.written}개</p>}
    </div>
  );
}
