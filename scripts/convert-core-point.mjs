import fs from 'fs';

const filePath = './_import/78/analysis.json';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

for (let q of data.questions) {
  if (q.corePoint && typeof q.corePoint === 'string') {
    const summary = q.corePoint.replace(/\*\*/g, '');
    const keywords = q.topics || [];
    
    q.corePoint = {
      summary,
      keywords,
      related: `이 문제는 ${keywords.join(', ')}에 대한 이해를 묻고 있습니다. 연관 개념을 함께 복습해 보세요.`
    };
  }
}

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('Done converting corePoints in analysis.json');
