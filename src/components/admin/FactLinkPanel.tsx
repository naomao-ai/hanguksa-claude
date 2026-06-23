"use client";

import { useState } from "react";
import { useUI } from "@/components/ui/UIProvider";
import { Loader2, Link2 } from "lucide-react";

/** 관리자 전용: Claude로 문제↔연표 일괄 연결(백필) */
export default function FactLinkPanel() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ processed: number; linked: number } | null>(null);

  async function run(mode: "missing" | "all") {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/link-facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "실패");
      setResult(d);
      toast(`${d.processed}문제 처리, ${d.linked}개 연결됨`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "연결 실패", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm text-muted">
        Claude로 문제를 분석해 관련 연표(factIds)를 자동 연결합니다. 문항 수에 따라 시간이 걸릴 수 있습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary px-4 py-2" onClick={() => run("missing")} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />} 미연결 문제 자동연결
        </button>
        <button className="btn btn-outline px-4 py-2" onClick={() => run("all")} disabled={busy}>
          전체 재연결
        </button>
      </div>
      {result && (
        <p className="text-sm">처리 {result.processed}문제 · 연결 {result.linked}개</p>
      )}
    </div>
  );
}
