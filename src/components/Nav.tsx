"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Home,
  Library,
  PencilLine,
  Timer,
  BarChart3,
  CalendarClock,
  GitBranch,
  Network,
  MessageCircleQuestion,
  Info,
  ShieldCheck,
  MonitorPlay,
  Trophy,
  Moon,
  Sun,
} from "lucide-react";

const NAV = [
  { href: "/", label: "홈", icon: Home },
  { href: "/bank", label: "문제은행", icon: Library },
  { href: "/study", label: "문제풀이", icon: PencilLine },
  { href: "/rounds", label: "회차 정복", icon: Trophy },
  { href: "/exam", label: "모의고사", icon: Timer },
  { href: "/review", label: "오답·복습", icon: CalendarClock },
  { href: "/analytics", label: "통계·경향", icon: BarChart3 },
  { href: "/timeline", label: "연표", icon: GitBranch },
  { href: "/network", label: "관계망", icon: Network },
  { href: "/tutor", label: "AI 튜터", icon: MessageCircleQuestion },
  { href: "/videos", label: "공부영상", icon: MonitorPlay },
  { href: "/updates", label: "업데이트", icon: Info },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const isDark =
      stored === "dark" ||
      (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
    setDark(isDark);
  }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  }

  return (
    <button
      onClick={toggle}
      className="btn btn-ghost p-2"
      aria-label="테마 전환"
      title="테마 전환"
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

import { useAuth } from "@/components/auth/AuthProvider";
import { LogIn, LogOut, User as UserIcon } from "lucide-react";

export default function Nav() {
  const pathname = usePathname();
  const { user, loading, loginWithGoogle, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-surface/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-1 px-3">
        <Link href="/" className="mr-2 flex items-center gap-2 font-bold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-fg">
            史
          </span>
          <span className="hidden sm:inline">한국사 마스터</span>
        </Link>
        <nav className="no-scrollbar flex flex-1 items-center gap-0.5 overflow-x-auto">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/12 text-primary"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                )}
              >
                <Icon size={16} />
                <span className="hidden md:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Auth Section */}
        <div className="ml-2 flex items-center gap-1 border-l pl-2 border-border">
          {!loading && (
            user ? (
              <div className="flex items-center gap-2">
                <Link href="/mypage/scraps" className="hidden text-sm font-medium hover:underline sm:inline px-2">
                  {user.displayName || "학습자"}님
                </Link>
                <button
                  onClick={logout}
                  className="btn btn-ghost p-2 text-muted"
                  title="로그아웃"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={loginWithGoogle}
                className="btn btn-primary px-3 py-1.5 text-sm flex items-center gap-1.5"
              >
                <LogIn size={16} />
                <span className="hidden sm:inline">로그인</span>
              </button>
            )
          )}
        </div>

        <Link
          href="/admin"
          aria-label="관리자"
          title="관리자"
          className={cn(
            "ml-1 flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors",
            pathname.startsWith("/admin")
              ? "bg-primary/12 text-primary"
              : "text-muted hover:bg-surface-2 hover:text-foreground"
          )}
        >
          <ShieldCheck size={16} />
          <span className="hidden lg:inline">관리자</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
