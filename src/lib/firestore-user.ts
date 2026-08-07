import { db } from "./firebase-client";
import { collection, doc, setDoc, getDoc, getDocs, writeBatch, query, orderBy, deleteDoc, serverTimestamp } from "firebase/firestore";
import { loadStore, saveStore, type Store } from "./local-store";
import { mergeStores } from "./sync-merge";

const USERS_COL = "users";

export interface ScrapData {
  id?: string;
  questionId?: string;
  factId?: string;
  memo: string;
  tags: string[];
  createdAt?: any;
}

/** 1. 사용자 초기화 및 로컬 데이터 동기화 */
export async function syncLocalStoreToCloud(userId: string, email: string | null, name: string | null) {
  const userRef = doc(db, USERS_COL, userId);
  const userSnap = await getDoc(userRef);

  // 이미 동기화(초기화)된 계정이면 진행하지 않음 (단순 덮어쓰기 방지)
  if (userSnap.exists() && userSnap.data().synced) {
    return;
  }

  // 로컬 스토리지 데이터 로드
  const local = loadStore();
  
  // 사용자의 기본 메타데이터 설정 (synced 플래그 포함)
  const userData = {
    uid: userId,
    email,
    name,
    streak: local.streak,
    settings: local.settings,
    badges: local.badges,
    attendance: local.attendance,
    bookmarks: local.bookmarks,
    synced: true, // 동기화 완료 마커
    updatedAt: serverTimestamp(),
  };

  const batch = writeBatch(db);
  batch.set(userRef, userData, { merge: true });

  // Attempts (최근 500개만 동기화하여 배치 한도 방지)
  const attemptsRef = collection(userRef, "attempts");
  local.attempts.slice(-500).forEach((attempt) => {
    const ref = doc(attemptsRef);
    batch.set(ref, attempt);
  });

  // ExamHistory
  const examRef = collection(userRef, "examHistory");
  local.examHistory.forEach((exam) => {
    const ref = doc(examRef);
    batch.set(ref, exam);
  });

  // SRS 
  const srsRef = collection(userRef, "srs");
  Object.entries(local.srs).forEach(([qId, srs]) => {
    const ref = doc(srsRef, qId);
    batch.set(ref, srs);
  });

  await batch.commit();

  // 로컬 스토리지는 그대로 둔다 — 다운로드가 병합(mergeStores)이므로 삭제할 필요가 없고,
  // 삭제하면 업로드 직후 앱이 재로드될 때 학습기록이 사라질 수 있다.
  window.dispatchEvent(new CustomEvent("hanguksa:store"));
}

/** 2. 수집(Scrap) / 메모 CRUD */
export async function saveScrap(userId: string, scrap: ScrapData) {
  const scrapsRef = collection(db, USERS_COL, userId, "scraps");
  const docRef = scrap.id ? doc(scrapsRef, scrap.id) : doc(scrapsRef);
  await setDoc(docRef, {
    ...scrap,
    createdAt: scrap.createdAt || serverTimestamp(),
  }, { merge: true });
}

export async function getScraps(userId: string): Promise<ScrapData[]> {
  const scrapsRef = collection(db, USERS_COL, userId, "scraps");
  const q = query(scrapsRef, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ScrapData));
}

export async function deleteScrap(userId: string, scrapId: string) {
  await deleteDoc(doc(db, USERS_COL, userId, "scraps", scrapId));
}

/** 3. 클라우드 기반 사용자 상태 조회 */
export async function getUserData(userId: string) {
  const snap = await getDoc(doc(db, USERS_COL, userId));
  return snap.exists() ? snap.data() : null;
}

/** 4. 클라우드 데이터를 로컬 저장소로 다운로드 및 병합 */
export async function downloadCloudToLocalStore(userId: string) {
  const userRef = doc(db, USERS_COL, userId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return; // 클라우드에 데이터가 없으면 진행 안함

  const userData = userSnap.data();

  // 서브컬렉션 병렬 로드
  const [attemptsSnap, examSnap, srsSnap] = await Promise.all([
    getDocs(collection(userRef, "attempts")),
    getDocs(collection(userRef, "examHistory")),
    getDocs(collection(userRef, "srs")),
  ]);

  const cloud: Partial<Store> = {
    streak: userData.streak,
    settings: userData.settings,
    badges: userData.badges,
    attendance: userData.attendance,
    bookmarks: userData.bookmarks,
    attempts: attemptsSnap.docs.map((d) => d.data() as any),
    examHistory: examSnap.docs.map((d) => d.data() as any),
    srs: Object.fromEntries(srsSnap.docs.map((d) => [d.id, d.data()])) as any,
  };

  // 덮어쓰기 대신 로컬과 클라우드를 손실 없이 병합(합집합) 후 저장.
  const merged = mergeStores(loadStore(), cloud);
  saveStore(merged);
  window.dispatchEvent(new CustomEvent("hanguksa:store"));
}
