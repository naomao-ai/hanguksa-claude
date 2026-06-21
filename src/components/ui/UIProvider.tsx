"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";
interface Toast { id: number; type: ToastType; msg: string }
interface ConfirmState {
  open: boolean;
  title: string;
  body?: string;
  confirmText: string;
  danger: boolean;
  resolve?: (v: boolean) => void;
}

interface UICtx {
  toast: (msg: string, type?: ToastType) => void;
  confirm: (opts: { title: string; body?: string; confirmText?: string; danger?: boolean }) => Promise<boolean>;
}

const Ctx = createContext<UICtx | null>(null);

export function useUI(): UICtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUI must be used within UIProvider");
  return c;
}

let _id = 0;

export default function UIProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [cf, setCf] = useState<ConfirmState>({ open: false, title: "", confirmText: "확인", danger: false });

  const toast = useCallback((msg: string, type: ToastType = "info") => {
    const id = ++_id;
    setToasts((t) => [...t, { id, type, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const confirm = useCallback(
    (opts: { title: string; body?: string; confirmText?: string; danger?: boolean }) =>
      new Promise<boolean>((resolve) => {
        setCf({
          open: true,
          title: opts.title,
          body: opts.body,
          confirmText: opts.confirmText ?? "확인",
          danger: opts.danger ?? false,
          resolve,
        });
      }),
    []
  );

  function closeConfirm(v: boolean) {
    cf.resolve?.(v);
    setCf((s) => ({ ...s, open: false, resolve: undefined }));
  }

  return (
    <Ctx.Provider value={{ toast, confirm }}>
      {children}

      {/* 토스트 스택 */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-pop pointer-events-auto flex items-start gap-2 rounded-xl border bg-surface p-3 text-sm shadow-[var(--shadow-lg)]"
          >
            {t.type === "success" && <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />}
            {t.type === "error" && <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent" />}
            {t.type === "info" && <Info size={18} className="mt-0.5 shrink-0 text-primary" />}
            <span className="flex-1 whitespace-pre-wrap leading-snug">{t.msg}</span>
            <button className="text-muted hover:text-foreground" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>

      {/* 확인 모달 */}
      {cf.open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => closeConfirm(false)}>
          <div className="animate-pop card w-full max-w-sm p-6 shadow-[var(--shadow-lg)]" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold">{cf.title}</h3>
            {cf.body && <p className="mt-1.5 text-sm text-muted">{cf.body}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => closeConfirm(false)}>취소</button>
              <button
                className={`btn px-4 py-2 text-sm ${cf.danger ? "btn-accent" : "btn-primary"}`}
                onClick={() => closeConfirm(true)}
              >
                {cf.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}
