"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getScraps, deleteScrap, type ScrapData } from "@/lib/firestore-user";
import { Loader2, Trash2, Bookmark } from "lucide-react";
import Link from "next/link";
import { fetchQuestionsByIds } from "@/lib/api";
import type { QuestionDTO } from "@/lib/types";

export default function MyScrapsPage() {
  const { user, loading: authLoading } = useAuth();
  const [scraps, setScraps] = useState<ScrapData[]>([]);
  const [questions, setQuestions] = useState<Record<string, QuestionDTO>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const data = await getScraps(user.uid);
        setScraps(data);

        // 관련된 질문 데이터 가져오기
        const qIds = data.map(s => s.questionId).filter(Boolean) as string[];
        if (qIds.length > 0) {
          const qs = await fetchQuestionsByIds(qIds);
          const qMap = qs.reduce((acc, q) => {
            acc[q.id] = q;
            return acc;
          }, {} as Record<string, QuestionDTO>);
          setQuestions(qMap);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, authLoading]);

  const handleDelete = async (scrapId: string) => {
    if (!user || !confirm("정말 삭제하시겠습니까?")) return;
    try {
      await deleteScrap(user.uid, scrapId);
      setScraps(prev => prev.filter(s => s.id !== scrapId));
    } catch (e) {
      alert("삭제 실패");
    }
  };

  if (authLoading || loading) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-10 space-y-4">
        <Bookmark size={48} className="text-muted" />
        <p className="text-muted">로그인 후 나만의 노트를 관리해보세요.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Bookmark className="text-primary" />
          나만의 수집 노트
        </h1>
        <span className="text-muted">{scraps.length}개</span>
      </header>

      {scraps.length === 0 ? (
        <div className="p-10 text-center text-muted">
          아직 수집된 노트가 없습니다.<br/>
          문제 풀이 중 헷갈리는 문항을 수집해보세요!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scraps.map(scrap => {
            const q = scrap.questionId ? questions[scrap.questionId] : null;
            return (
              <div key={scrap.id} className="card p-5 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex flex-wrap gap-1">
                    {scrap.tags.map(t => (
                      <span key={t} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                        #{t}
                      </span>
                    ))}
                  </div>
                  <button 
                    onClick={() => scrap.id && handleDelete(scrap.id)}
                    className="text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="rounded bg-surface-2 p-3 text-sm">
                  {scrap.memo || <span className="text-muted italic">메모 없음</span>}
                </div>

                {q && (
                  <div className="border-t pt-3 mt-3">
                    <p className="text-sm font-medium line-clamp-2">{q.stem}</p>
                    <Link href={`/study?q=${q.id}`} className="text-xs text-primary hover:underline mt-1 inline-block">
                      문제 다시 보기 &rarr;
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
