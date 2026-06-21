"use client";

import { useCallback, useEffect, useState } from "react";
import { useUI } from "@/components/ui/UIProvider";
import { fetchVideos } from "@/lib/api";
import type { VideoDTO } from "@/lib/types";
import { watchUrl } from "@/lib/youtube";
import { Loader2, MonitorPlay, Check, Trash2, ExternalLink } from "lucide-react";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 관리자 전용: 공부영상 등록 + 목록/삭제 */
export default function VideoForm() {
  const { toast, confirm } = useUI();
  const [url, setUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState(todayStr());
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [preview, setPreview] = useState<{ title: string; channel: string; thumbnailUrl: string } | null>(null);
  const [title, setTitle] = useState("");
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);

  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setVideos(await fetchVideos());
    setLoadingList(false);
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  async function loadMeta() {
    if (!url.trim()) { setPreview(null); return; }
    setLoadingMeta(true);
    try {
      const res = await fetch(`/api/videos/oembed?url=${encodeURIComponent(url.trim())}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "메타 조회 실패");
      setPreview({ title: d.title, channel: d.channel, thumbnailUrl: d.thumbnailUrl });
      setTitle(d.title || "");
    } catch (e) {
      setPreview(null);
      toast(e instanceof Error ? e.message : "메타 조회 실패", "error");
    } finally {
      setLoadingMeta(false);
    }
  }

  async function save() {
    if (!url.trim()) { toast("YouTube URL을 입력하세요.", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), publishedAt, aiAnalysis, title: title.trim() || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "저장 실패");
      toast("영상이 등록되었습니다.", "success");
      setUrl(""); setAiAnalysis(""); setPreview(null); setTitle(""); setPublishedAt(todayStr());
      loadList();
    } catch (e) {
      toast(e instanceof Error ? e.message : "저장 실패", "error");
    } finally {
      setSaving(false);
    }
  }

  async function del(id: string) {
    const ok = await confirm({ title: "영상 삭제", body: "이 영상을 삭제할까요?", confirmText: "삭제", danger: true });
    if (!ok) return;
    const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
    if (res.ok) { toast("삭제되었습니다.", "success"); loadList(); }
    else toast("삭제 실패 (권한 확인)", "error");
  }

  return (
    <div className="space-y-5">
      <div className="card space-y-3 p-5">
        <p className="text-sm text-muted">최태성 등 국사 학습 영상을 등록합니다. URL을 넣으면 제목·썸네일을 자동으로 불러옵니다.</p>

        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} onBlur={loadMeta}
            placeholder="YouTube URL (예: https://youtu.be/...)"
            className="flex-1 rounded-lg border bg-surface px-3 py-2 text-sm" />
          <button className="btn btn-outline px-3 py-2 text-sm" onClick={loadMeta} disabled={loadingMeta}>
            {loadingMeta ? <Loader2 className="animate-spin" size={16} /> : <MonitorPlay size={16} />} 불러오기
          </button>
        </div>

        {preview && (
          <div className="flex gap-3 rounded-lg border bg-surface-2 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.thumbnailUrl} alt="" className="h-20 w-32 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1 space-y-1">
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목 (자동/수정 가능)"
                className="w-full rounded border bg-surface px-2 py-1 text-sm font-medium" />
              <p className="text-xs text-muted">{preview.channel || "채널 정보 없음"}</p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5">영상 게시일
            <input type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)}
              className="rounded border bg-surface px-2 py-1" />
          </label>
        </div>

        <textarea value={aiAnalysis} onChange={(e) => setAiAnalysis(e.target.value)} rows={5}
          placeholder="유튜브 AI 분석 결과를 붙여넣으세요. 저장 시 카드용으로 간략히 정리됩니다."
          className="w-full rounded-lg border bg-surface p-2 text-sm" />

        <button className="btn btn-primary w-full py-2.5" onClick={save} disabled={saving}>
          {saving ? <><Loader2 className="animate-spin" size={18} /> 저장 중…</> : <><Check size={18} /> 영상 등록</>}
        </button>
      </div>

      {/* 등록된 영상 목록 */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted">등록된 영상 {videos.length}개</h3>
        {loadingList ? (
          <div className="flex justify-center p-6"><Loader2 className="animate-spin text-muted" /></div>
        ) : videos.length === 0 ? (
          <p className="card p-4 text-center text-sm text-muted">등록된 영상이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {videos.map((v) => (
              <li key={v.id} className="card flex items-center gap-3 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={v.thumbnailUrl || ""} alt="" className="h-12 w-20 shrink-0 rounded object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{v.title}</p>
                  <p className="truncate text-xs text-muted">{new Date(v.publishedAt).toLocaleDateString("ko-KR")}{v.channel ? ` · ${v.channel}` : ""}</p>
                </div>
                <a href={watchUrl(v.youtubeId)} target="_blank" rel="noreferrer" className="shrink-0 text-muted hover:text-foreground"><ExternalLink size={16} /></a>
                <button onClick={() => del(v.id)} className="shrink-0 text-muted hover:text-red-500"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
