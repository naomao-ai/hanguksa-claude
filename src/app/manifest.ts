import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "한국사 마스터 — 한능검 대비",
    short_name: "한국사 마스터",
    description: "한국사능력검정시험 대비 학습 앱",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5f0",
    theme_color: "#0f6e64",
    lang: "ko",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
