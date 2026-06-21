"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MessageCircleQuestion, Send, Loader2, Square } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string }

const SUGGESTIONS = [
  "무신정변의 배경을 설명해줘",
  "광종의 개혁 정책을 정리해줘",
  "강화도 조약이 불평등한 이유는?",
  "고려와 조선의 토지 제도 차이는?",
];

function TutorInner() {
  const params = useSearchParams();
  const questionId = params.get("q");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  function stop() {
    abortRef.current?.abort();
  }

  useEffect(() => {
    if (questionId) {
      send("이 문항을 자세히 해설해줘. 왜 그 선지가 정답인지 알려줘.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || streaming) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setStreaming(true);
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, questionId: questionId || undefined }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "응답 실패");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { role: "assistant", content: (last?.content || "") + "\n\n⏹ 응답이 중단되었습니다." };
          return copy;
        });
      } else {
        const msg = e instanceof Error ? e.message : "오류가 발생했습니다.";
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `⚠️ ${msg}\n\n(ANTHROPIC_API_KEY·크레딧 잔액을 확인하세요.)`,
          };
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-9rem)] max-w-2xl flex-col">
      <header className="mb-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><MessageCircleQuestion className="text-primary" /> AI 튜터</h1>
        <p className="text-sm text-muted">문제은행·해설을 근거로 답합니다. {questionId && "(선택한 문항 컨텍스트 포함)"}</p>
      </header>

      <div className="card flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted">
            <p>무엇이든 물어보세요. 예시:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-surface-2">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === "user" ? "bg-primary text-primary-fg" : "bg-surface-2"
            }`}>
              {m.content || (streaming && i === messages.length - 1 ? <Loader2 className="animate-spin" size={16} /> : "")}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="질문을 입력하세요…"
          className="flex-1 rounded-xl border bg-surface px-4 py-3 text-sm"
        />
        {streaming ? (
          <button type="button" className="btn btn-outline px-4" onClick={stop} title="응답 중단">
            <Square size={16} /> 중단
          </button>
        ) : (
          <button type="submit" className="btn btn-primary px-4" disabled={!input.trim()}>
            <Send size={18} />
          </button>
        )}
      </form>
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin text-muted" /></div>}>
      <TutorInner />
    </Suspense>
  );
}
