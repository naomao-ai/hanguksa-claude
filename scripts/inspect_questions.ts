import { getAllQuestions } from "../src/lib/firestore.ts";
import * as fs from "fs";

async function run() {
  const qs = await getAllQuestions();
  const suspicious = [];

  const regex = /\([가-마]\)/;

  for (const q of qs) {
    if (q.imageUrl && !q.passage && q.stem.match(regex)) {
      // Check if imageDescription also has (가)
      // Sometimes imageDescription might be null, but let's check it
      if (q.imageDescription && q.imageDescription.match(regex)) {
        suspicious.push(q);
      } else if (!q.imageDescription) {
        // If there's no description at all, we can't be sure, but it's suspicious
        suspicious.push(q);
      }
    }
  }

  // Sort by examRound descending, then number ascending
  suspicious.sort((a, b) => {
    if (b.examRound !== a.examRound) return (b.examRound || 0) - (a.examRound || 0);
    return (a.number || 0) - (b.number || 0);
  });

  const reportLines = [];
  reportLines.push("# 🚨 (가)~(마) 지문/이미지 누락 의심 문항 전수검사 결과");
  reportLines.push("");
  reportLines.push(`전체 문항 수: ${qs.length}개`);
  reportLines.push(`의심 문항 수: ${suspicious.length}개`);
  reportLines.push("");
  reportLines.push("## 검사 기준");
  reportLines.push("1. 문제 발문(stem)에 `(가)`, `(나)` 등이 포함되어 있음");
  reportLines.push("2. 별도의 텍스트 지문(passage)이 없음 (오직 이미지에 의존)");
  reportLines.push("3. 이미지 해설(imageDescription)에는 `(가)` 내용이 포함되어 있거나 아예 없음 (이미지 크롭 오류 시 문제 풀이 불가)");
  reportLines.push("");
  reportLines.push("## 🔍 의심 문항 리스트");
  reportLines.push("| 회차 | 문항 번호 | 문제 발문 (Stem) | 이미지 해설 (Description) |");
  reportLines.push("| :--- | :--- | :--- | :--- |");
  
  for (const q of suspicious) {
    const desc = q.imageDescription ? q.imageDescription.replace(/\n/g, " ") : "(없음)";
    const shortDesc = desc.length > 50 ? desc.substring(0, 50) + "..." : desc;
    reportLines.push(`| ${q.examRound}회 ${q.level} | ${q.number}번 | ${q.stem} | ${shortDesc} |`);
  }

  fs.writeFileSync("inspection_report.md", reportLines.join("\n"), "utf-8");
  console.log("Inspection complete. Found", suspicious.length, "suspicious questions.");
}

run();
