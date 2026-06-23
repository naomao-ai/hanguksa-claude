---
name: update
description: "한국사 앱(hanguksa)을 갱신·재배포한다. 변경사항을 커밋·빌드검증·푸시하고, Cloud Run 재배포 명령을 안내하며, 배포 후 라이브 서버를 검증하고 서버 주소를 보고한다. 사용자가 /update 라고 입력하거나 '서버 갱신/재배포/업데이트'를 요청할 때 사용."
---

# /update — 한국사 앱 서버 갱신·재배포

hanguksa 앱(Next.js 16 + Firebase, Cloud Run 호스팅)의 코드 변경을 **라이브 서버에 반영**하는 전체 프로세스. Cloud Run 재배포가 곧 서버 재시작(새 리비전 생성)이다.

## 프로젝트 상수

- GitHub: `naomao-ai/hanguksa-claude` (브랜치 `main`)
- GCP 프로젝트: `hanguksa-claude`, 리전 `asia-northeast3`, 서비스명 `hanguksa`
- 라이브 URL: `https://hanguksa-198132893049.asia-northeast3.run.app`
- Cloud Shell: `https://console.cloud.google.com/cloudshell?project=hanguksa-claude`
- 로컬 작업 디렉토리: `C:\01.claude\hanguksa`

## 제약 (반드시 인지)

실제 배포(`gcloud run deploy`)는 **owner 계정(`naomaoai@gmail.com`)으로 인증된 Cloud Shell에서만** 가능하다. 이유: 로컬에 gcloud 미설치, 서비스 계정은 Cloud Run/Cloud Build 권한 없음(403), 브라우저 Cloud Shell을 직접 구동할 도구 없음. 따라서 이 스킬은 배포 전후를 자동화하고, **배포 실행 한 줄만 사용자가 Cloud Shell에서** 돌린다. 절대 로컬에서 gcloud 배포를 시도하지 말 것.

## 절차

### 1. 변경사항 커밋 + 빌드 검증 (Claude 자동)

- `git -C C:/01.claude/hanguksa status --short` 로 미커밋 변경 확인.
- 변경이 있으면 의미 있는 한국어 커밋 메시지로 커밋. 메시지 말미에 반드시:
  `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- **`npm run build` 로 빌드 통과 확인** (실패 시 즉시 중단하고 원인 보고 — 깨진 코드를 배포하지 않는다).
- 테스트가 있으면 `npm test` 도 실행해 통과 확인.

### 2. GitHub 푸시 (Claude 자동)

- `git push origin main` 실행. 푸시된 커밋 해시를 보고.
- 인증(Username/Password 또는 token)이 필요해 푸시가 막히면, **토큰을 이 파일이나 커밋에 절대 남기지 말고** 사용자에게 PAT를 요청해 일시적으로 remote URL에 넣어 푸시한 뒤 **즉시 토큰 없는 URL로 원복**한다:
  - 푸시: `git remote set-url origin https://<TOKEN>@github.com/naomao-ai/hanguksa-claude.git && git push origin main`
  - 원복: `git remote set-url origin https://github.com/naomao-ai/hanguksa-claude.git`

### 3. 재배포 명령 안내 (사용자가 Cloud Shell에서 실행)

Cloud Shell URL과 함께 아래 **한 줄**을 제시한다:

```bash
cd ~/hanguksa-claude && git pull && gcloud run deploy hanguksa --source . --region asia-northeast3 --allow-unauthenticated --set-env-vars "FIREBASE_STORAGE_BUCKET=hanguksa-claude.firebasestorage.app,FIRESTORE_DATABASE_ID=hanguksa-claude" --set-secrets "ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,ADMIN_PASSWORD=ADMIN_PASSWORD:latest,ADMIN_SECRET=ADMIN_SECRET:latest,FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest"
```

자주 나오는 문제 대응:
- `cd: no such file or directory` → 폴더 없음. `git clone https://<TOKEN>@github.com/naomao-ai/hanguksa-claude.git ~/hanguksa-claude` 후 재실행.
- `git pull` 충돌/로컬변경 오류 → `git fetch origin && git reset --hard origin/main` 로 강제 정렬 후 배포.
- `PERMISSION_DENIED` (run.services.get 등) → Cloud Shell 계정이 owner(`naomaoai@gmail.com`)인지 우측 상단 프로필에서 확인·전환.
- 빌드 실패 → Cloud Shell에서 `gcloud builds log <BUILD_ID> --region asia-northeast3` 또는 그 폴더에서 직접 `docker build .` / `npm run build` 로 원인 확인.

### 4. 배포 검증 + 서버주소 보고 (Claude 자동)

사용자가 배포 완료(또는 Service URL)를 알리면:

- 라이브 응답 확인:
  `curl -s -o /dev/null -w "%{http_code}" https://hanguksa-198132893049.asia-northeast3.run.app/api/releases` → 200
- **새 코드가 실제로 반영됐는지** 변경 지점으로 검증한다. 예) 이번 변경이 `/api/facts` 응답 필드를 바꿨다면:
  `curl -s https://hanguksa-198132893049.asia-northeast3.run.app/api/facts` 가 새 필드(예: `questionCount`, `category`)를 포함하는지 확인. 옛 필드만 나오면 배포가 아직 안 된 것 → 사용자에게 재배포/캐시 안내.
- 주요 페이지(`/`, `/timeline`, `/bank`, `/admin`) HTTP 200 점검.
- 마지막에 **라이브 서버 주소를 명확히 보고**: `https://hanguksa-198132893049.asia-northeast3.run.app`

## 선택: 완전 자동 배포(CI) 제안

매번 Cloud Shell이 번거로우면, push 시 자동 배포되도록 1회 설정할 수 있다고 안내한다:
- **GitHub Actions**: `.github/workflows/deploy.yml` + deploy 권한 서비스 계정 키를 GitHub Secret(`GCP_SA_KEY`)으로 등록 → main push 시 `gcloud run deploy` 자동 실행.
- 또는 **Cloud Build 트리거**(콘솔에서 GitHub 연결, main push → Cloud Run 배포).

설정에는 Cloud Run/Cloud Build 권한을 가진 서비스 계정과 1회 콘솔 설정이 필요하므로, 사용자가 원할 때만 별도로 진행한다.
