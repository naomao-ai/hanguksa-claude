import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind 클래스 병합 헬퍼 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 숫자를 퍼센트 문자열로 (정수 반올림) */
export function pct(n: number): string {
  if (!isFinite(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}

/** YYYY-MM-DD 포맷 */
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 두 날짜 사이의 일수 (b - a) */
export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / 86_400_000);
}
