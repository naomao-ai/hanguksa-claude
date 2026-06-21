import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * 서버 전용 Firebase Admin 초기화.
 * 자격증명 우선순위:
 *  1) FIREBASE_SERVICE_ACCOUNT (JSON 문자열) — 로컬/CI
 *  2) GOOGLE_APPLICATION_CREDENTIALS (키 파일 경로) — 로컬
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
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({ credential: applicationDefault(), storageBucket: bucket });
  }
  // App Hosting / Cloud Run: 자격증명·projectId·bucket 모두 런타임에서 자동
  return initializeApp({ storageBucket: bucket });
}

const app = createApp();

export const db: Firestore = getFirestore(app);
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
