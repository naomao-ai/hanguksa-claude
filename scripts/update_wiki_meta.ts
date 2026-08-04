import fs from "fs";
import { setQuestionWikiMeta } from "../src/lib/firestore.ts";

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: node update_wiki_meta.ts <path-to-json>");
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw); // Array of { id: string, wikiMeta: { ... } }

  let count = 0;
  for (const item of data) {
    if (item.id && item.wikiMeta) {
      await setQuestionWikiMeta(item.id, item.wikiMeta);
      count++;
      console.log(`Updated question: ${item.id}`);
    }
  }
  console.log(`Successfully updated ${count} questions.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
