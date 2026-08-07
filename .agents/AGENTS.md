# 프로젝트 작업 규칙

- 모든 작업이 완료된 후에는 마지막 단계로 반드시 프로젝트 배포(Deploy)를 진행해야 합니다. 
  (예: `npx firebase-tools deploy` 로 Firebase 규칙 배포 후, `gcloud run deploy hanguksa --source . --region asia-northeast3` 로 Cloud Run 웹앱 배포)
