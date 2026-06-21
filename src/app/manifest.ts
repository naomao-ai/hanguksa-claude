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
      // 앱 아이콘은 추후 추가 (설치형 PWA 기본 동작에는 필수 아님)
    ],
  };
}
