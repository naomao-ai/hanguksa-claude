# 배포 가이드 — 한국사 마스터

이 앱은 **SQLite 파일 DB + 관리자 업로드** 구조입니다. 따라서 DB 쓰기가 유지되려면
**영구 파일시스템이 있는 환경**(로컬/VPS/볼륨 마운트)이 필요합니다.
서버리스(Vercel 등)에 올리려면 호스팅 DB로 마이그레이션해야 합니다(아래 D 참고).

배포 전 체크:
- `.env`(또는 호스트 환경변수)에 `ADMIN_PASSWORD`를 **기본값(admin1234)에서 반드시 변경**.
- AI 분석·튜터를 쓰려면 `ANTHROPIC_API_KEY`와 **크레딧 잔액** 필요(없어도 나머지 기능 동작).

---

## A. 로컬 / 사내망 프로덕션 (가장 간단, SQLite 그대로)
```bash
npm ci
npx prisma db push        # DB 생성
npm run seed              # (선택) 샘플 데이터
npm run build
npx next start -H 0.0.0.0 -p 3000
```
- 같은 네트워크의 다른 기기에서 `http://<이 PC IP>:3000` 으로 접속.
- 관리자: `http://<IP>:3000/admin` (ADMIN_PASSWORD 로그인).
- Windows 방화벽에서 3000 포트 인바운드 허용이 필요할 수 있습니다.
- 상시 구동: PM2(`pm2 start "npx next start -p 3000" --name hanguksa`) 또는 작업 스케줄러 권장.

## B. Docker (어디서나, SQLite 영속 볼륨)
```bash
docker compose up -d --build
# 또는
docker build -t hanguksa .
docker run -d -p 3000:3000 \
  -e ADMIN_PASSWORD=강력한비번 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v hanguksa-db:/app/prisma \
  hanguksa
```
- DB는 `hanguksa-db` 볼륨(`/app/prisma`)에 영속.
- 최초 1회 샘플 데이터: `SEED_ON_START=1` 환경변수.

## C. Node 상주 호스트 (Railway / Render / Fly.io)
- 빌드: `npm run build`, 시작: `npx prisma db push && npx next start -p $PORT`
- **영구 볼륨을 `/app/prisma`(또는 dev.db 경로)에 연결**해야 데이터가 유지됨(미연결 시 재배포마다 초기화).
- 환경변수: `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY` 설정.
- 무료 플랜은 볼륨 미지원인 경우가 있으니 확인.

## D. Vercel (서버리스) — DB 마이그레이션 필요
SQLite 파일은 유지되지 않습니다. 다음 중 하나로 전환:
1. **Turso(libSQL)**: SQLite 호환, 변경 최소. `@prisma/adapter-libsql` + Turso URL/토큰.
2. **Postgres(Neon/Supabase)**: `schema.prisma`의 `provider`를 `postgresql`로, `DATABASE_URL` 환경변수화 후 `prisma migrate`.
- 이후 Vercel에 GitHub 연동 → 환경변수(`DATABASE_URL`, `ADMIN_PASSWORD`, `ANTHROPIC_API_KEY`) 설정 → 배포.
- 원하시면 이 전환 작업을 대신 진행해 드립니다(계정 로그인/토큰만 준비).

---

## 운영 메모
- 관리자 로그인 쿠키는 **HTTPS일 때만 secure**로 설정되어 사내망 HTTP에서도 로그인 유지됩니다. 외부 공개 시에는 **HTTPS(리버스 프록시: Nginx/Caddy)** 적용을 권장합니다.
- 백업: SQLite는 `prisma/dev.db` 파일만 복사하면 됩니다(또는 볼륨 스냅샷).
- 헬스체크: `GET /api/releases` (200).
