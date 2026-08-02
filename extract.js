const fs = require('fs');
const data = JSON.parse(fs.readFileSync('_import/78/analysis.json'));
let out = '';
data.questions.forEach(q => {
  out += `Q${q.number}. ${q.stem}\n`;
  if (q.passage) out += `[사료] ${q.passage}\n`;
  if (q.imageDescription) out += `[이미지] ${q.imageDescription}\n`;
  out += `정답: ${q.answerIndex + 1}번 - ${q.choices[q.answerIndex]}\n\n`;
});
fs.writeFileSync('extract.txt', out);
