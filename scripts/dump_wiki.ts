import { getAllQuestions } from "../src/lib/firestore.ts";
import fs from "fs";

async function main() {
  const allQ = await getAllQuestions();
  const withWiki = allQ.filter(q => q.wikiMeta);
  
  // 처음 5개 항목만 추출하여 파일로 저장
  const preview = withWiki.slice(0, 5).map(q => ({
    id: q.id,
    stem: q.stem,
    wikiMeta: q.wikiMeta
  }));
  
  fs.writeFileSync("wiki_meta_preview.json", JSON.stringify(preview, null, 2), "utf8");
  console.log(`Saved 5 preview items to wiki_meta_preview.json (out of ${withWiki.length} total completed)`);
}

main().catch(console.error);
