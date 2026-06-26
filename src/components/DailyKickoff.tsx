"use client";

import type { Attendance } from "@/lib/local-store";
import { Flame, CalendarCheck, Sparkles, X } from "lucide-react";

/**
 * 앱 시작(오늘 첫 방문) 시 1회 노출되는 출석 + 오늘의 랜덤 5문제 동기부여 팝업.
 * 출석 체크는 호출 측(홈)에서 이미 끝낸 뒤 갱신된 attendance를 받아 표시만 한다.
 */
export default function DailyKickoff({
  attendance,
  onSolve,
  onClose,
}: {
  attendance: Attendance;
  onSolve: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="card m-4 w-full max-w-sm p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="닫기" className="absolute right-3 top-3 text-muted hover:text-foreground">
          <X size={18} />
        </button>

        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
          <CalendarCheck size={26} />
        </div>
        <h2 className="mt-3 text-xl font-bold">오늘도 출석 완료! 🎉</h2>

        <div className="mt-4 flex justify-center gap-3">
          <div className="rounded-xl bg-surface-2 px-4 py-2">
            <div className="flex items-center justify-center gap-1 text-xs text-muted"><Flame size={13} className="text-accent" /> 연속</div>
            <div className="text-lg font-bold">{attendance.current}일</div>
          </div>
          <div className="rounded-xl bg-surface-2 px-4 py-2">
            <div className="text-xs text-muted">누적 출석</div>
            <div className="text-lg font-bold">{attendance.total}일</div>
          </div>
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted">
          <Sparkles size={15} className="text-primary" /> 오늘의 랜덤 5문제로 가볍게 시작해볼까요?
        </p>

        <div className="mt-5 space-y-2">
          <button className="btn btn-primary w-full py-2.5" onClick={onSolve}>오늘의 5문제 풀기</button>
          <button className="btn btn-ghost w-full py-2" onClick={onClose}>오늘은 건너뛰기</button>
        </div>
      </div>
    </div>
  );
}
