import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase 웹 config는 브라우저에 노출되는 공개 식별자이므로 기본값을 하드코딩한다.
// (.env.production이 CI 빌드 컨텍스트에 없어도 빌드/런타임 클라이언트 초기화가 동작하도록)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC5pDndpQxwtkr-hUYUixSmqw4guW4-v8E",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hanguksa-claude.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hanguksa-claude",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "hanguksa-claude.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "198132893049",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:198132893049:web:90b47d5afafeef277ddba8",
};

// Initialize Firebase only if it hasn't been initialized already
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
