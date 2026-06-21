"use client";

import { useEffect, useState } from "react";
import { fetchVideos } from "@/lib/api";
import { embedUrl, watchUrl } from "@/lib/youtube";
import type { VideoDTO } from "@/lib/types";
import { Loader2, MonitorPlay, Play, ExternalLink, ChevronDown } from "lucide-react";

const MAX_CARDS = 5;

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideos()
      .then(setVideos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = videos.slice(0, MAX_CARDS);
  const rest = videos.slice(MAX_CARDS);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <MonitorPlay className="text-accent" /> 공부영상
        </h1>
        <p className="text-muted">최태성 등 국사 학습 영상을 모았습니다. 카드를 누르면 바로 재생됩니다.</p>
      </header>

      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>
      ) : videos.length === 0 ? (
        <div className="card p-8 text-center text-muted">아직 등록된 영상이 없습니다.</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((v) => <VideoCard key={v.id} v={v} />)}
          </div>

          {rest.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted">이전 영상 {rest.length}개</h2>
              <ul className="divide-y rounded-xl border">
                {rest.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 p-3">
                    <a href={watchUrl(v.youtubeId)} target="_blank" rel="noreferrer"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent">
                      <Play size={15} />
                    </a>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{v.title}</p>
                      <p className="text-xs text-muted">{fmtDate(v.publishedAt)}{v.channel ? ` · ${v.channel}` : ""}</p>
                    </div>
                    <a href={watchUrl(v.youtubeId)} target="_blank" rel="noreferrer"
                      className="btn btn-ghost shrink-0 px-2 py-1 text-xs"><ExternalLink size={14} /> 유튜브</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function VideoCard({ v }: { v: VideoDTO }) {
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <div className="card flex flex-col overflow-hidden">
      {/* 썸네일 / 인라인 플레이어 */}
      <div className="relative aspect-video bg-surface-2">
        {playing ? (
          <iframe
            src={embedUrl(v.youtubeId, true)}
            title={v.title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full" aria-label="재생">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.thumbnailUrl || ""} alt={v.title} className="h-full w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center bg-black/20 transition-colors group-hover:bg-black/30">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-accent text-white shadow-lg">
                <Play size={22} className="ml-0.5" />
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="font-semibold leading-snug line-clamp-2">{v.title}</h3>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span className="chip">{fmtDate(v.publishedAt)}</span>
          {v.channel && <span className="chip">{v.channel}</span>}
        </div>

        {v.summary && (
          <p className="text-sm text-muted line-clamp-3">{v.summary}</p>
        )}

        {v.aiAnalysis && (
          <div>
            <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs font-medium text-primary">
              <ChevronDown size={14} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
              AI 분석 전문 {open ? "접기" : "보기"}
            </button>
            {open && (
              <p className="mt-2 whitespace-pre-wrap rounded-lg border border-accent/20 bg-accent/5 p-3 text-xs leading-relaxed">
                {v.aiAnalysis}
              </p>
            )}
          </div>
        )}

        <a href={watchUrl(v.youtubeId)} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="btn btn-outline mt-auto w-full py-2 text-sm">
          <ExternalLink size={15} /> YouTube에서 보기
        </a>
      </div>
    </div>
  );
}
