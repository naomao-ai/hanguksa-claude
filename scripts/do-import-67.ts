import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { analyzeQuestionImages, type ImageInput } from '../src/lib/ai/claude';

async function main() {
  const round = 67;
  const level = 's';
  const pdfPath = `exam/67/67회 한국사_문제지(심화).pdf`;
  const ansPdfPath = `exam/67/67회 한국사_정답표(심화).pdf`;
  const outDir = `_import/67s/pages`;
  const jsonPath = `_import/67s/analysis.json`;

  console.log('1. 렌더링 시작...');
  execSync(`npm run render:exam -- "${pdfPath}" --out "${outDir}" --split`, { stdio: 'inherit' });
  execSync(`npm run render:exam -- "${ansPdfPath}" --out "${outDir}_ans" --pages 1`, { stdio: 'inherit' });

  console.log('2. 이미지 수집...');
  const files = await fs.readdir(outDir);
  const qFiles = files.filter(f => f.endsWith('.png')).sort();
  const qImages = await Promise.all(qFiles.map(async f => {
    const data = await fs.readFile(path.join(outDir, f), 'base64');
    return { name: f, media_type: 'image/png', data, role: 'question' as const };
  }));

  const ansFiles = await fs.readdir(`${outDir}_ans`);
  const aFiles = ansFiles.filter(f => f.endsWith('.png')).sort();
  const aImages = await Promise.all(aFiles.map(async f => {
    const data = await fs.readFile(path.join(`${outDir}_ans`, f), 'base64');
    return { name: f, media_type: 'image/png', data, role: 'answer' as const };
  }));

  console.log(`총 문제 이미지 ${qImages.length}장, 정답 이미지 ${aImages.length}장`);

  // Claude API 20장 제한이 있으므로, 2번(12장씩) 나누어 호출
  const chunks = [];
  const chunkSize = 12;
  for (let i = 0; i < qImages.length; i += chunkSize) {
    chunks.push(qImages.slice(i, i + chunkSize));
  }
  
  chunks[0].push(aImages[0]);

  let allQuestions: any[] = [];
  let examRound = 0;
  let examLevel = '';

  for (let i = 0; i < chunks.length; i++) {
    console.log(`3. Claude API 호출 (청크 ${i + 1}/${chunks.length})...`);
    if (i > 0) await new Promise(r => setTimeout(r, 5000));
    const inputs: ImageInput[] = chunks[i].map(img => ({
      media_type: img.media_type as any,
      data: img.data,
      role: img.role
    }));

    try {
      const { result, usage } = await analyzeQuestionImages(inputs, "빠짐없이 모든 문항을 정확히 추출할 것.");
      console.log(`청크 ${i+1} 성공: ${result.questions.length}문항 추출 (${usage.total_tokens} tokens)`);
      if (result.examRound) examRound = result.examRound;
      if (result.level) examLevel = result.level;
      
      const mappedQuestions = result.questions.map(q => {
        if (q.imageSourceIndex != null) {
          const imgName = chunks[i][q.imageSourceIndex].name;
          const globalIdx = qFiles.indexOf(imgName);
          q.imageSourceIndex = globalIdx >= 0 ? globalIdx : null;
        }
        if (q.choices && q.choiceImages) {
          q.choiceImages.forEach(ci => {
            if (ci.imageSourceIndex != null) {
              const imgName = chunks[i][ci.imageSourceIndex].name;
              const globalIdx = qFiles.indexOf(imgName);
              ci.imageSourceIndex = globalIdx >= 0 ? globalIdx : null;
            }
          });
        }
        return q;
      });
      
      allQuestions = allQuestions.concat(mappedQuestions);
    } catch (e) {
      console.error(`청크 ${i+1} 에러:`, e);
      throw e;
    }
  }

  const uniqueQ = Array.from(new Map(allQuestions.map(q => [q.number, q])).values());
  uniqueQ.sort((a, b) => a.number - b.number);

  console.log(`최종 추출 문항: ${uniqueQ.length}개`);

  const finalAnalysis = {
    examRound: examRound || round,
    level: examLevel || 'SIMHWA',
    questions: uniqueQ
  };

  await fs.writeFile(jsonPath, JSON.stringify(finalAnalysis, null, 2), 'utf-8');
  console.log(`4. ${jsonPath} 저장 완료`);

  console.log('5. DB 업로드...');
  execSync(`npm run import:exam -- --json ${jsonPath} --images ${outDir} --upload --replace-round --release "제67회 한국사능력검정시험 심화"`, { stdio: 'inherit' });
  console.log('완료!');
}

main().catch(console.error);
