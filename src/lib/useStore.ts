"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStore, saveStore, type Store } from "./local-store";

/**
 * localStorage 기반 학습 기록 구독 훅.
 * update(fn)으로 변경하면 저장 + 모든 구독 컴포넌트가 갱신된다.
 */
export function useStore(): {
  store: Store;
  ready: boolean;
  update: (fn: (s: Store) => Store) => void;
  set: (s: Store) => void;
} {
  const [store, setStore] = useState<Store>(() => loadStore());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setStore(loadStore());
    setReady(true);
    const onChange = () => setStore(loadStore());
    window.addEventListener("hanguksa:store", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("hanguksa:store", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const update = useCallback((fn: (s: Store) => Store) => {
    const next = fn(loadStore());
    saveStore(next);
    setStore(next);
  }, []);

  const set = useCallback((s: Store) => {
    saveStore(s);
    setStore(s);
  }, []);

  return { store, ready, update, set };
}
