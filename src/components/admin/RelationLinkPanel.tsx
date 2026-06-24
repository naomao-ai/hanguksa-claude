"use client";

import { useState } from "react";
import { useUI } from "@/components/ui/UIProvider";
import { Loader2, Share2 } from "lucide-react";

/** 관리자 전용: Claude로 연표 이전/이후 관계망 일괄 생성 */
export default function RelationLinkPanel() {
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
      <p className="text-sm text-muted">
        Claude로 각 연표 항목의 이전(배경·원인)·이후(결과·영향) 관계를 생성합니다. 시간이 걸릴 수 있습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary px-4 py-2" onClick={() => run("missing")} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />} 미생성 항목 관계 생성
        </button>
        <button className="btn btn-outline px-4 py-2" onClick={() => run("all")} disabled={busy}>
          전체 재생성
        </button>
      </div>
      {result && <p className="text-sm">처리 {result.processed}항목 · 관계 {result.linked}개</p>}
    </div>
  );
}
