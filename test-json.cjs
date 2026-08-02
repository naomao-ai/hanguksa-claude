const fs = require('fs');
const data = JSON.parse(fs.readFileSync('_import/78/analysis.json', 'utf-8'));
console.log(data.questions.find(q => q.number === 41).corePoint);
