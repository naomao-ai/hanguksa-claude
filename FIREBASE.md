# Firebase 배포 가이드 — 한국사 마스터

이 앱은 데이터를 **Firestore**, 문항 이미지를 **Firebase Storage**에 저장하고,
**Firebase App Hosting**(Next.js SSR)으로 배포합니다. 서버(API 라우트)에서만
Firebase Admin SDK로 접근하며, 클라이언트 직접 접근은 보안 규칙으로 차단합니다.

> ⚠️ 코드·설정·마이그레이션 스크립트는 모두 준비되어 있습니다. 아래 단계 중
> **프로젝트 생성·결제·`firebase login`·실제 배포**는 본인 계정에서 직접 수행해야 합니다.

---

## 0. 사전 준비
- Node 22+, `npm i -g firebase-tools`
- 결제 카드(Blaze 종량제 — App Hosting과 서버의 외부 Claude API 호출에 **필수**. 무료 Spark로는 둘 다 불가)

## 1. Firebase 프로젝트 생성
1. https://console.firebase.google.com → **프로젝트 추가**
2. 프로젝트 ID 기록(예: `hanguksa-master`)
3. **요금제 → Blaze로 업그레이드**

## 2. Firestore · Storage 활성화
1. 콘솔 → **Firestore Database → 데이터베이스 만들기 → Native 모드** (리전: `asia-northeast3` 서울 권장)
2. 콘솔 → **Storage → 시작하기** (같은 리전). 버킷명 기록(보통 `<프로젝트ID>.appspot.com`)

## 3. 로컬 설정값 교체
- `.firebaserc` 의 `YOUR_FIREBASE_PROJECT_ID` → 실제 프로젝트 ID
- `apphosting.yaml` 의 `YOUR_FIREBASE_PROJECT_ID.appspot.com` → 실제 버킷명

## 4. 서비스 계정 키(로컬 마이그레이션용)
1. 콘솔 → **프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성** → `service-account.json` 다운로드(프로젝트 루트, **git 제외됨**)
2. `.env.local` 에 추가:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=./service-account.json
   FIREBASE_STORAGE_BUCKET=<프로젝트ID>.appspot.com
   ```
   (기존 `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD` 도 그대로 유지)

## 5. 기존 데이터 이전 (SQLite → Firestore/Storage)
```bash
npm run migrate:firebase
```
- 현재 `prisma/dev.db` 의 문항·선지·릴리스·사실·영상을 Firestore로,
  base64 이미지는 Storage로 업로드합니다. 문서 id는 보존되며 재실행 시 덮어씁니다.
- 콘솔 Firestore/Storage에서 데이터가 들어왔는지 확인하세요.

## 6. 규칙 배포
```bash
firebase login
firebase deploy --only firestore:rules,storage
```

## 7. 로컬 동작 확인
```bash
npm run dev
```
- `/bank` 문항 조회, `/admin`(비번=ADMIN_PASSWORD) 로그인 후 추가/삭제,
  AI 업로드 시 이미지가 Storage URL로 저장·표시되는지 확인.

## 8. App Hosting 배포
1. 코드를 GitHub 저장소에 push
2. 콘솔 → **App Hosting → 백엔드 만들기** → GitHub 저장소·브랜치 연결, 리전 선택
3. **시크릿 등록**(Secret Manager):
   ```bash
   firebase apphosting:secrets:set ANTHROPIC_API_KEY
   firebase apphosting:secrets:set ADMIN_PASSWORD
   firebase apphosting:secrets:set ADMIN_SECRET
   ```
   (`apphosting.yaml` 이 이 시크릿들을 런타임에 주입)
4. push 시 자동 빌드·배포. 발급된 URL에서 7번 항목을 재검증.

---

## 비용·운영 메모
- Firestore/Storage/App Hosting 모두 종량제. 학습앱 트래픽에선 소액(대개 무료 한도 내)이나 카드 등록은 필요.
- 데이터 접근은 전부 서버 경유 → Firestore 규칙은 전면 차단(`firestore.rules`), 이미지 경로만 공개 읽기(`storage.rules`).

## 폴백: Next.js 16 어댑터 문제 시
App Hosting 빌드가 Next 16 미지원으로 실패하면 동일 GCP 프로젝트에서 **Cloud Run**으로 배포(기존 `Dockerfile` 사용). 이때 Firestore/Storage는 그대로 사용하며, 서비스 계정 또는 Cloud Run 기본 서비스 계정에 Firestore/Storage 권한을 부여하고 `FIREBASE_STORAGE_BUCKET`·`ANTHROPIC_API_KEY`·`ADMIN_PASSWORD` 환경변수를 설정합니다.
