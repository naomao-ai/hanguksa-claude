"use client";

import { useState } from "react";
import { saveScrap } from "@/lib/firestore-user";
import { useAuth } from "@/components/auth/AuthProvider";
import { X, Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";

interface ScrapBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  questionId?: string;
  factId?: string;
  title: string;
}

export default function ScrapBottomSheet({ isOpen, onClose, questionId, factId, title }: ScrapBottomSheetProps) {
  const { user } = useAuth();
  const [memo, setMemo] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!user) {
      alert("로그인이 필요합니다.");
      return;
    }
    setLoading(true);
    try {
      const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
      await saveScrap(user.uid, {
        questionId,
        factId,
        memo,
        tags,
      });
      alert("수집되었습니다!");
      onClose();
    } catch (e) {
      console.error(e);
      alert("수집 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Bookmark className="text-primary" size={20} />
            수집하기
          </h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-surface-2"><X size={20} /></button>
        </div>
        
        <div className="mb-4 text-sm text-muted">
          <p className="line-clamp-2 font-medium text-foreground">{title}</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">메모</label>
            <textarea
              className="w-full rounded-xl border bg-surface-1 p-3 text-sm focus:border-primary focus:outline-none"
              rows={3}
              placeholder="나만의 핵심 노트를 남겨보세요..."
              value={memo}
              onChange={e => setMemo(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">태그 (쉼표로 구분)</label>
            <input
              type="text"
              className="w-full rounded-xl border bg-surface-1 p-3 text-sm focus:border-primary focus:outline-none"
              placeholder="예: 헷갈리는선지, 문화재, 고려"
              value={tagsInput}
              onChange={e => setTagsInput(e.target.value)}
            />
          </div>
          <button
            className={cn("btn btn-primary w-full py-3", loading && "opacity-50")}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "저장 중..." : "수집 노트에 저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
