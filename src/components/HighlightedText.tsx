import React from "react";

/* ── 중요 내용 하이라이팅 컴포넌트 ── */
export default function HighlightedText({ text, keywords = [] }: { text: string; keywords?: string[] }) {
  // 마침표 뒤 공백 기준으로 문장 분리
  const sentences = text.split(/(?<=\.(?:\s|$))/).filter(Boolean);
  
  return (
    <>
      {sentences.map((sentence, i) => {
        // '암기 팁', '오답 노트', '학습 맥락' 등 명시적 태그가 있거나
        const hasTag = /^\[(암기 팁|오답 노트|학습 맥락)\]/.test(sentence);
        // 핵심 키워드가 포함되어 있으면 중요 문장으로 간주
        const hasKeyword = keywords.length > 0 && keywords.some(k => k.length > 1 && sentence.includes(k));
        
        const isImportant = hasTag || hasKeyword;
        
        if (isImportant) {
          // 명시적 태그인 경우 뱃지 스타일로
          const match = sentence.match(/^\[(.*?)\](.*)/);
          if (match && hasTag) {
            return (
              <span key={i} className="inline-block mr-1">
                <span className="font-bold text-red-600 mr-1">[{match[1]}]</span>
                <span className="text-red-600 underline underline-offset-4 decoration-red-200/60 font-medium">
                  {match[2]}
                </span>
              </span>
            );
          }
          
          return (
            <span key={i} className="text-red-600 underline underline-offset-4 decoration-red-200/60 font-medium mr-1">
              {sentence}
            </span>
          );
        }
        
        return <span key={i} className="text-muted-foreground mr-1">{sentence}</span>;
      })}
    </>
  );
}
