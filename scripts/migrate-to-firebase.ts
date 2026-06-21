/**
 * 일회성 마이그레이션: 현재 SQLite(Prisma) → Firestore + Storage.
 *
 * 실행 전 환경변수:
 *   FIREBASE_STORAGE_BUCKET=<프로젝트>.appspot.com
 *   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json   (또는 FIREBASE_SERVICE_ACCOUNT=JSON문자열)
 *
 * 실행:  npm run migrate:firebase
 *
 * 기존 문서 id를 보존하며, base64 imageUrl은 Storage로 업로드 후 URL로 교체한다.
 * 멱등성: 같은 id로 다시 쓰므로 재실행 시 덮어쓴다(중복 생성 없음).
 */
import { PrismaClient } from "../src/generated/prisma/index.js";
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../src/lib/firebase-admin.ts";
import { uploadImageFromDataUrl } from "../src/lib/storage.ts";

const prisma = new PrismaClient();

function parseArray(s: string | null | undefined): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

async function migrateQuestions() {
  const rows = await prisma.question.findMany({ include: { choices: true } });
  let n = 0;
  for (const q of rows) {
    let imageUrl = q.imageUrl ?? null;
    if (imageUrl && imageUrl.startsWith("data:")) {
      imageUrl = await uploadImageFromDataUrl(imageUrl, q.id);
    }
    await db.collection("questions").doc(q.id).set({
      level: q.level,
      examRound: q.examRound ?? null,
      examYear: q.examYear ?? null,
      number: q.number ?? null,
      stem: q.stem,
      passage: q.passage ?? null,
      imageUrl,
      imageDescription: q.imageDescription ?? null,
      explanation: q.explanation ?? null,
      answerIndex: q.answerIndex,
      era: q.era,
      topics: parseArray(q.topics),
      qType: q.qType,
      difficulty: q.difficulty ?? null,
      source: q.source,
      choices: [...q.choices].sort((a, b) => a.order - b.order).map((c) => ({ order: c.order, text: c.text })),
      createdAt: Timestamp.fromDate(q.createdAt),
    });
    n++;
    if (n % 20 === 0) console.log(`  questions ${n}/${rows.length}`);
  }
  console.log(`✓ questions: ${n}`);
}

async function migrateReleases() {
  const rows = await prisma.release.findMany();
  for (const r of rows) {
    await db.collection("releases").doc(r.id).set({
      version: r.version,
      title: r.title,
      notes: r.notes,
      examRound: r.examRound ?? null,
      examLevel: r.examLevel ?? null,
      questionCount: r.questionCount,
      addedCount: r.addedCount,
      publishedAt: Timestamp.fromDate(r.publishedAt),
    });
  }
  console.log(`✓ releases: ${rows.length}`);
}

async function migrateFacts() {
  const rows = await prisma.fact.findMany();
  for (const f of rows) {
    await db.collection("facts").doc(f.id).set({
      era: f.era,
      year: f.year ?? null,
      title: f.title,
      kind: f.kind,
      body: f.body,
      relatedTo: parseArray(f.relatedTo),
      createdAt: Timestamp.fromDate(f.createdAt),
    });
  }
  console.log(`✓ facts: ${rows.length}`);
}

async function migrateVideos() {
  const rows = await prisma.video.findMany();
  for (const v of rows) {
    await db.collection("videos").doc(v.id).set({
      youtubeId: v.youtubeId,
      url: v.url,
      title: v.title,
      channel: v.channel ?? null,
      thumbnailUrl: v.thumbnailUrl ?? null,
      publishedAt: Timestamp.fromDate(v.publishedAt),
      aiAnalysis: v.aiAnalysis,
      summary: v.summary,
      createdAt: Timestamp.fromDate(v.createdAt),
    });
  }
  console.log(`✓ videos: ${rows.length}`);
}

async function main() {
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error("FIREBASE_STORAGE_BUCKET 환경변수가 필요합니다 (예: my-proj.appspot.com).");
  }
  console.log("마이그레이션 시작 → Firestore + Storage");
  await migrateQuestions();
  await migrateReleases();
  await migrateFacts();
  await migrateVideos();
  console.log("완료. 콘솔에서 데이터 확인 후 앱을 재배포하세요.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
