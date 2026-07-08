# Cloud Run 배포 명령서 (프로젝트: hanguksa-claude)

> 프로덕션 빌드 검증 완료. 아래 순서대로 **PowerShell**에서 실행하면 배포됩니다.
> Firestore·Storage는 이미 같은 프로젝트(`hanguksa-claude`)에 준비돼 있습니다.

## 0. Google Cloud CLI 설치 (한 번만)
- 설치: https://cloud.google.com/sdk/docs/install (Windows 설치 관리자)
- 설치 후 새 PowerShell 창에서 `gcloud --version` 확인

## 1. 로그인 + 프로젝트 지정
```powershell
gcloud auth login
gcloud config set project hanguksa-claude
```

## 2. 필요한 API 켜기
```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
```

## 3. 시크릿 등록 (Secret Manager)
> ⚠️ **줄바꿈 없이** 저장해야 합니다(API 키에 \n이 붙으면 인증 실패). 아래는 줄바꿈 없는 파일로 만들어 등록하는 안전한 방법입니다.

```powershell
cd C:\01.claude\hanguksa

# (1) Claude API 키 — 따옴표 안에 실제 키를 넣으세요
[IO.File]::WriteAllText("$PWD\_k.txt", "sk-ant-여기에-실제-키")
gcloud secrets create ANTHROPIC_API_KEY --data-file=_k.txt; Remove-Item _k.txt

# (2) 관리자 비밀번호 — 운영용으로 강하게 변경 권장
[IO.File]::WriteAllText("$PWD\_p.txt", "강한관리자비밀번호")
gcloud secrets create ADMIN_PASSWORD --data-file=_p.txt; Remove-Item _p.txt

# (3) Firebase 서비스 계정 키(JSON 파일 통째로)
gcloud secrets create FIREBASE_SERVICE_ACCOUNT --data-file=service-account.json
```

## 4. 배포 (소스 → Cloud Build → Cloud Run)
```powershell
gcloud run deploy hanguksa `
  --source . `
  --region asia-northeast3 `
  --allow-unauthenticated `
  --memory 1Gi `
  --cpu 1 `
  --set-env-vars "FIRESTORE_DATABASE_ID=hanguksa-claude,FIREBASE_STORAGE_BUCKET=hanguksa-claude.firebasestorage.app,CLAUDE_MODEL=claude-opus-4-8" `
  --set-secrets "ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,ADMIN_PASSWORD=ADMIN_PASSWORD:latest,FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest"
```
- 처음 실행 시 Artifact Registry 저장소 생성 여부를 물으면 **Y**
- 완료되면 **Service URL** (예: `https://hanguksa-xxxxx-an.a.run.app`)이 출력됩니다 → 그게 접속 주소

## 5. 시크릿 접근 권한 (위 4가 권한 오류면 1회 실행)
```powershell
$PROJNUM = gcloud projects describe hanguksa-claude --format="value(projectNumber)"
gcloud secrets add-iam-policy-binding ANTHROPIC_API_KEY    --member="serviceAccount:$PROJNUM-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding ADMIN_PASSWORD       --member="serviceAccount:$PROJNUM-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding FIREBASE_SERVICE_ACCOUNT --member="serviceAccount:$PROJNUM-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```
그 후 4번 배포 명령을 다시 실행하세요.

## 배포 후 확인
- 출력된 URL 접속 → 문제은행/연표 데이터가 보이면 성공
- `URL/admin` → 관리자 로그인(3-(2)에서 정한 비밀번호)

## 재배포 (코드 수정 후)
```powershell
gcloud run deploy hanguksa --source . --region asia-northeast3
```
(env/secret은 유지되므로 위 옵션 없이 재배포 가능)
