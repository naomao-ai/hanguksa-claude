import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { readFileSync } from "fs";

/**
 * 서버 전용 Firebase Admin 초기화.
 * 자격증명 우선순위:
 *  1) FIREBASE_SERVICE_ACCOUNT (JSON 문자열) — 로컬/CI
 *  2) GOOGLE_APPLICATION_CREDENTIALS (키 파일 경로) — 파일을 직접 읽어 cert() 사용
 *  3) ADC (App Hosting / Cloud Run 런타임에서 자동)
 * 스토리지 버킷은 FIREBASE_STORAGE_BUCKET 으로 지정(예: my-proj.appspot.com).
 */
function createApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const bucket = process.env.FIREBASE_STORAGE_BUCKET;
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT;

  if (saJson) {
    const sa = JSON.parse(saJson);
    return initializeApp({ credential: cert(sa), storageBucket: bucket });
  }
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credPath) {
    // applicationDefault() 는 projectId 자동감지 실패 케이스가 있어 직접 cert() 사용
    const sa = JSON.parse(readFileSync(credPath, "utf-8"));
    return initializeApp({ credential: cert(sa), storageBucket: bucket });
  }
  // App Hosting / Cloud Run: 자격증명·projectId·bucket 모두 런타임에서 자동
  return initializeApp({ storageBucket: bucket });
}

const app = createApp();

// 신규 Firebase 프로젝트는 DB ID가 (default)가 아닌 프로젝트 ID일 수 있음
const dbId = process.env.FIRESTORE_DATABASE_ID || "(default)";
export const db: Firestore = dbId === "(default)" ? getFirestore(app) : getFirestore(app, dbId);
// Firestore 권장 설정: undefined 필드 무시(부분 업데이트 편의)
try {
  db.settings({ ignoreUndefinedProperties: true });
} catch {
  // 이미 사용된 인스턴스면 settings가 throw — 무시
}

export const storage = getStorage(app);

/** 기본 스토리지 버킷 핸들 */
export function bucket() {
  return storage.bucket();
}
