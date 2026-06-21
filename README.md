# 한국사 마스터 — 한능검 대비 웹앱

한국사능력검정시험(한능검) 대비 학습 웹앱. 기출 문제를 AI로 분석해 문제은행으로 만들고,
시대·인물·유형별 학습, 모의고사, 출제경향 분석, 오답 복습, AI 튜터까지 한 곳에서 제공합니다.

## 기술 스택
- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**
- **Prisma 6 + SQLite** — 공유 문제은행 저장
- **Claude API (Opus 4.8, Vision)** — 이미지/PDF 기출 분석, AI 튜터
- **Recharts** — 통계·출제경향 시각화
- 개인 학습 기록(풀이 이력·오답·SRS·스트릭)은 **브라우저 localStorage**에 저장 (계정 불필요)

## 시작하기

```bash
npm install
npx prisma db push        # SQLite DB 생성
npm run seed              # 샘플 문항·사실 시드 (선택)
npm run dev               # http://localhost:3000
```

### 환경변수 (`.env.local`)
```
ANTHROPIC_API_KEY=sk-ant-...   # AI 분석·튜터에 필요
# CLAUDE_MODEL=claude-opus-4-8 # (선택) 모델 변경
ADMIN_PASSWORD=변경하세요        # 관리자(업로드/배포) 비밀번호
# ADMIN_SECRET=임의문자열        # (선택) 세션 토큰 솔트
```
Claude 키가 없어도 열람·풀이·모의고사·통계·연표·복습은 모두 동작합니다.

## 운영 구조 (다수 열람 + 관리자 업로드)
- **일반 사용자**: 로그인 없이 문제은행을 **열람**하고 학습. 학습 기록은 기기(localStorage)에 저장.
- **관리자**(`/admin`, `ADMIN_PASSWORD` 로그인): 회차 종료 후 기출을 **AI 분석·검수·저장**하고, **업데이트(릴리스)를 발행**해 데이터셋 버전을 올립니다.
- **앱 업데이트 기준 정보**: 발행된 릴리스로 **데이터셋 버전·최근 반영 회차·총 문항수·최종 갱신일**이 홈 배너와 [`/updates`](src/app/updates/page.tsx)에 노출됩니다.
- 쓰기 API(`/api/analyze`, `/api/questions*`, `/api/releases`)는 모두 **관리자 인증 필수**, 읽기 API는 공개.

## 수익화
프리미엄 구독 + 시험 패스권 하이브리드 전략, AI 원가 통제, 저작권 고려, 단계별 로드맵은 [MONETIZATION.md](MONETIZATION.md) 참조.

## 주요 기능
| 메뉴 | 설명 |
|---|---|
| 문제은행 | 기출 이미지 **AI 분석 → 구조화**, 수동/검수 저장, 시대·유형 필터 |
| 문제풀이 | 시대·인물·유형별 출제, 즉시 채점·해설, 즐겨찾기 |
| 모의고사 | 50문항·타이머·OMR·자동 채점·**급수 환산** |
| 오답·복습 | **SM-2 간격반복(SRS)** 복습 큐 + 오답노트 |
| 사료 트레이닝 | 자료 제시형 문항 집중 학습 |
| 빈출 암기카드 | 핵심 키워드 플래시카드 (SRS 적용) |
| 통계·경향 | 시대별 정답률·추이, 취약영역 진단, 출제경향 분포 |
| 연표 | 시대 흐름 인터랙티브 타임라인 |
| 관계망 | 인물·사건·제도 force 그래프 |
| 학습 플랜 | D-day 역산 커리큘럼, 스트릭·배지, 데이터 백업 |
| AI 튜터 | 문제은행·해설 근거 RAG 챗봇 (스트리밍) |

## 스크립트
- `npm run dev` / `build` / `start`
- `npm run test` — 핵심 로직(SRS·채점) 단위 테스트 (Vitest)
- `npm run seed` — 시드 데이터 적재
- `npm run db:push` — 스키마를 DB에 반영
- `npm run sim` — 30회 기능 시뮬레이션(필터·검색·게이팅·생성/삭제 불변식 검증, 서버 실행 중 필요)
- `npm run sim:perf` — 30회 동시요청 부하·안정성 측정

## 성능·안정화
- 공개 읽기 중 **정적 데이터(facts·releases·trends)** 는 `Cache-Control`로 캐싱(다수 동시 열람 시 DB 부하 절감).
- **랜덤 출제(`/api/questions?random=1`)** 는 매 호출 새 세트가 필요하므로 캐싱하지 않음.
- 복습/북마크는 서버 `ids` 일괄조회로 전체 적재 없이 처리.
- UX: 전역 토스트·확인 모달, 풀이 키보드 단축키(1~5/Enter), AI 튜터 응답 중단, 문제은행 키워드 검색.

## 구조
```
src/
├─ app/                # 페이지 + API 라우트(/api/*)
├─ components/         # Nav, StudyRunner, ExamRunner, Chips
├─ lib/
│  ├─ ai/              # Claude 클라이언트 + 분석 스키마
│  ├─ domain.ts        # 시대·유형·등급 상수, 급수 환산
│  ├─ srs.ts           # SM-2 간격반복
│  ├─ scoring.ts       # 모의고사 채점
│  └─ local-store.ts   # 브라우저 학습 기록
└─ generated/prisma/   # Prisma 생성 클라이언트
```

> 업로드한 기출문제는 개인 학습 목적 사용을 전제로 합니다. 공개 배포 시 저작권을 검토하세요.
