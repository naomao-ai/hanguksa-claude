import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import UIProvider from "@/components/ui/UIProvider";

export const metadata: Metadata = {
  title: "한국사 마스터 — 한능검 대비",
  description:
    "한국사능력검정시험 대비 학습 앱. 실전 문제 AI 분석·문제은행, 시대/인물별 출제, 모의고사, 출제경향 분석, 오답노트와 AI 튜터까지.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0f6e64",
  width: "device-width",
  initialScale: 1,
};

// 다크모드 깜빡임 방지: hydration 전에 테마 클래스 적용
const themeScript = `
(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(!s&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(d)document.documentElement.classList.add('dark');}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col font-sans antialiased">
        <UIProvider>
          <Nav />
          <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-6 sm:px-4">
            {children}
          </main>
          <footer className="border-t py-6 text-center text-xs text-muted">
            한국사 마스터 · 학습용 앱 · 업로드 자료는 개인 학습 목적에 한합니다
          </footer>
        </UIProvider>
      </body>
    </html>
  );
}
