"use client";

import { useCallback, useEffect, useState } from "react";
import UploadPanel from "@/components/admin/UploadPanel";
import ManualForm from "@/components/admin/ManualForm";
import VideoForm from "@/components/admin/VideoForm";
import { useUI } from "@/components/ui/UIProvider";
import { fetchQuestions } from "@/lib/api";
import { eraLabel, levelLabel, LEVELS } from "@/lib/domain";
import type { QuestionDTO } from "@/lib/types";
import { Loader2, Lock, LogOut, Sparkles, Plus, Rocket, Trash2, ShieldAlert, MonitorPlay } from "lucide-react";

type Tab = "upload" | "manual" | "release" | "manage" | "video";

export default function AdminPage() {
  const { toast } = useUI();
  const [state, setState] = useState<"loading" | "locked" | "admin" | "unconfigured">("loading");
  const [tab, setTab] = useState<Tab>("upload");
  const [lastAdded, setLastAdded] = useState(0);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/status");
    const d = await res.json();
    if (!d.configured) setState("unconfigured");
    else setState(d.admin ? "admin" : "locked");
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (state === "loading") return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>;
  if (state === "unconfigured") return <Unconfigured />;
  if (state === "locked") return <LoginForm onSuccess={refresh} />;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">관리자 콘솔</h1>
          <p className="text-muted">기출을 업로드하고 데이터셋 업데이트를 발행합니다.</p>
        </div>
        <button
          className="btn btn-ghost px-3 py-2 text-sm"
          onClick={async () => { await fetch("/api/admin/login", { method: "DELETE" }); refresh(); }}
        >
          <LogOut size={16} /> 로그아웃
        </button>
      </header>

      <div className="flex flex-wrap gap-1 border-b">
        {[
          { k: "upload", label: "AI 업로드", icon: Sparkles },
          { k: "manual", label: "직접 추가", icon: Plus },
          { k: "release", label: "업데이트 발행", icon: Rocket },
          { k: "manage", label: "문항 관리", icon: Trash2 },
          { k: "video", label: "공부영상", icon: MonitorPlay },
        ].map(({ k, label, icon: Icon }) => (
          <button key={k} onClick={() => setTab(k as Tab)}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${tab === k ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"}`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === "upload" && (
        <UploadPanel onSaved={(n) => { setLastAdded(n); toast(`${n}문항 저장됨. '업데이트 발행'에서 변경 내역을 공지하세요.`, "success"); setTab("release"); }} />
      )}
      {tab === "manual" && <ManualForm onSaved={() => { setLastAdded((x) => x + 1); toast("문항이 저장되었습니다.", "success"); }} />}
      {tab === "release" && <ReleaseForm defaultAdded={lastAdded} onPublished={() => { setLastAdded(0); }} />}
      {tab === "manage" && <ManageList />}
      {tab === "video" && <VideoForm />}
    </div>
  );
}

function Unconfigured() {
  return (
    <div className="mx-auto max-w-md">
      <div className="card space-y-2 p-6 text-center">
        <ShieldAlert className="mx-auto text-accent" />
        <h2 className="text-lg font-bold">관리자 비밀번호 미설정</h2>
        <p className="text-sm text-muted">
          서버 환경변수 <code className="rounded bg-surface-2 px-1">ADMIN_PASSWORD</code> 를 설정한 뒤 다시 접속하세요.
          (예: <code className="rounded bg-surface-2 px-1">.env.local</code> 에 <code>ADMIN_PASSWORD=...</code>)
        </p>
      </div>
    </div>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setBusy(false);
    if (res.ok) onSuccess();
    else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "로그인 실패");
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <form onSubmit={submit} className="card space-y-4 p-6">
        <div className="text-center">
          <Lock className="mx-auto text-primary" />
          <h1 className="mt-2 text-xl font-bold">관리자 로그인</h1>
          <p className="text-sm text-muted">업로드·배포 권한이 필요합니다.</p>
        </div>
        <input
          type="password" value={pw} onChange={(e) => setPw(e.target.value)}
          placeholder="관리자 비밀번호" autoFocus
          className="w-full rounded-lg border bg-surface px-3 py-2.5"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button className="btn btn-primary w-full py-2.5" disabled={busy || !pw}>
          {busy ? <Loader2 className="animate-spin" size={18} /> : "로그인"}
        </button>
      </form>
    </div>
  );
}

function ReleaseForm({ defaultAdded, onPublished }: { defaultAdded: number; onPublished: () => void }) {
  const { toast } = useUI();
  const [title, setTitle] = useState("");
  const [examRound, setExamRound] = useState("");
  const [examLevel, setExamLevel] = useState("BOTH");
  const [addedCount, setAddedCount] = useState(String(defaultAdded || ""));
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setAddedCount(String(defaultAdded || "")); }, [defaultAdded]);

  async function publish() {
    if (!title.trim()) { toast("제목을 입력하세요.", "error"); return; }
    setBusy(true);
    const res = await fetch("/api/releases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title, notes,
        examRound: examRound || undefined,
        examLevel,
        addedCount: addedCount ? Number(addedCount) : 0,
      }),
    });
    setBusy(false);
    if (res.ok) {
      const d = await res.json();
      toast(`데이터셋 v${d.release.version} 발행 완료. 사용자에게 업데이트 정보가 노출됩니다.`, "success");
      setTitle(""); setNotes(""); setExamRound(""); setAddedCount("");
      onPublished();
    } else {
      const d = await res.json().catch(() => ({}));
      toast(d.error || "발행 실패", "error");
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm text-muted">기출 업로드 후 변경 내역을 발행하면 데이터셋 버전이 올라가고 사용자에게 &lsquo;업데이트 기준 정보&rsquo;로 표시됩니다.</p>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (예: 68회 심화 반영)" className="w-full rounded border bg-surface px-3 py-2 text-sm" />
      <div className="flex flex-wrap gap-2 text-sm">
        <input value={examRound} onChange={(e) => setExamRound(e.target.value)} placeholder="반영 회차" className="w-28 rounded border bg-surface px-2 py-1.5" />
        <select value={examLevel} onChange={(e) => setExamLevel(e.target.value)} className="rounded border bg-surface px-2 py-1.5">
          <option value="BOTH">심화+기본</option>
          {LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <input value={addedCount} onChange={(e) => setAddedCount(e.target.value)} placeholder="추가 문항 수" className="w-28 rounded border bg-surface px-2 py-1.5" />
      </div>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="변경 내용 (사용자에게 표시됩니다)" rows={3} className="w-full rounded border bg-surface p-2 text-sm" />
      <button className="btn btn-accent w-full py-2.5" onClick={publish} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" size={18} /> : <><Rocket size={16} /> 업데이트 발행</>}
      </button>
    </div>
  );
}

function ManageList() {
  const { toast, confirm } = useUI();
  const [questions, setQuestions] = useState<QuestionDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setQuestions(await fetchQuestions({ limit: 300 }));
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function del(id: string) {
    const ok = await confirm({ title: "문항 삭제", body: "이 문항을 삭제할까요? 되돌릴 수 없습니다.", confirmText: "삭제", danger: true });
    if (!ok) return;
    const res = await fetch(`/api/questions/${id}`, { method: "DELETE" });
    if (res.ok) { toast("삭제되었습니다.", "success"); load(); }
    else toast("삭제 실패 (권한 확인)", "error");
  }

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted" /></div>;

  return (
    <ul className="space-y-2">
      {questions.map((q) => (
        <li key={q.id} className="card flex items-start gap-3 p-4">
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap gap-1 text-xs text-muted">
              <span>{levelLabel(q.level)}</span>·<span>{eraLabel(q.era)}</span>{q.examRound ? <>·<span>{q.examRound}회</span></> : null}·<span>{q.source}</span>
            </div>
            <p className="line-clamp-2 text-sm">{q.stem}</p>
          </div>
          <button onClick={() => del(q.id)} className="shrink-0 text-muted hover:text-red-500"><Trash2 size={16} /></button>
        </li>
      ))}
    </ul>
  );
}
