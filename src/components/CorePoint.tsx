import React from "react";
import { cn } from "@/lib/utils";

/**
 * AI가 생성한 핵심 내용(corePoint) 구조화된 데이터를 렌더링합니다.
 */
export default function CorePoint({
  data,
  className,
}: {
  data: { summary: string; keywords: string[]; related: string };
  className?: string;
}) {
  if (!data) return null;

  return (
    <div className={cn("rounded-lg bg-primary/5 p-4 text-sm leading-relaxed border border-primary/20 space-y-3", className)}>
      <div>
        <div className="font-bold text-primary mb-1">핵심요약</div>
        <div className="text-foreground">{data.summary}</div>
      </div>
      
      {data.keywords && data.keywords.length > 0 && (
        <div>
          <div className="font-bold text-primary mb-1">핵심키워드</div>
          <div className="flex flex-wrap gap-1.5">
            {data.keywords.map((kw, i) => (
              <span key={i} className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-xs font-semibold border border-accent/20">
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {data.related && (
        <div>
          <div className="font-bold text-primary mb-1">연관내용</div>
          <div className="text-foreground">{data.related}</div>
        </div>
      )}
    </div>
  );
}
