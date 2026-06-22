# 설계: 연표 세분화 + 문제–연표 AI 연결 + 연표 학습

- 작성일: 2026-06-23
- 대상 앱: hanguksa (Next.js 16 + Firebase, Cloud Run 배포)
- 상태: 승인됨 (사용자 확인 완료)

## 1. 배경과 목표

한국사 앱의 연표(`facts`)와 문제(`questions`)는 현재 `era`만 공유할 뿐
구조적 연결이 없다. 본 작업의 목표:

1. **연표 세분화·보강**: 시대별 연표를 한능검 빈출 중심으로 세분화·집필하고,
   소시대/주제/중요도 등 분류 구조를 추가한다.
2. **문제–연표 연결**: 문제마다 관련 연표 항목(`factIds`)을 **Claude AI로 분석**하여
   부여한다. 기존 문제는 일괄 백필, 신규 문제는 생성 시 자동(백그라운드) 연결.
3. **연표 학습 흐름**: 연표 상세에서 "관련 문제 N개 풀기"로 연결된 문제만 모아 푼다.

## 2. 결정 사항 (브레인스토밍 합의)

| 항목 | 결정 |
|---|---|
| 연표 보강 범위 | 콘텐츠 대량 집필 (구조 변경 포함). 1차 목표 약 150~200개(시대 균형) |
| 연결 방식 | Claude로 분석해 명시적 `factIds` 부여 (기존+신규 모두) |
| AI 연결 실행 | 관리자 일괄(백필) + 신규 저장 시 자동 백그라운드 (응답 비차단) |
| 학습 흐름 | 연표 상세 → "관련 문제 풀기" → 전용 라우트에서 기존 StudyRunner 재사용 |

## 3. 데이터 모델 (Firestore)

### 3.1 Fact(연표) — 필드 추가 (기존 문서 비파괴)

기존: `era, year, title, kind, body, relatedTo[]`

추가:
- `period?: string` — 소시대/세부 시기 라벨 (예: "삼국-전성기", "조선-후기").
- `category?: string` — 주제 분류: `정치 | 경제 | 사회 | 문화 | 대외관계`.
- `importance?: 1|2|3` — 빈출·중요도.
- `keywords: string[]` — 문제 매칭·검색용 핵심어. (`relatedTo`는 연표 간 참조 의미로 유지)

기존 57개 문서는 새 필드가 없어도 동작해야 하며(옵셔널), 집필 시 채운다.

### 3.2 Question — 연결 필드 추가

- `factIds: string[]` — 연결된 연표 문서 ID 배열. 기본 `[]`.

`QuestionDTO`(types.ts), `docToQuestion`, `buildQuestionDoc`,
`NewQuestion`에 `factIds` 반영. 미설정 문서는 `[]`로 직렬화.

## 4. AI 연결 엔진

`src/lib/ai/link-facts.ts` (서버 전용):
- 입력: 문제 1건(`stem, passage, topics, era, explanation, qType`) +
  **같은 `era`(및 인접 시대) 연표 후보 목록**(id+title+year+keywords)으로 프롬프트 축소.
- 모델: `CLAUDE_MODEL`(기본 Opus). tool 호출(JSON 스키마)로
  `{ factIds: string[], reason?: string }` 강제. 후보 id 화이트리스트 내 값만 채택.
- 0개 매칭 허용(억지 연결 금지). 상한(예: 최대 5개).

실행 경로:
- **관리자 일괄** `POST /api/admin/link-facts`:
  - `mode: "missing"` → `factIds`가 빈 문제만 처리(74개 백필).
  - `mode: "all"` → 전체 재연결.
  - 순차 처리(레이트리밋 안전), 결과 `{ processed, linked, skipped }` 반환.
- **신규 자동(백그라운드)**: 단일/bulk 생성 응답을 즉시 반환한 뒤
  서버에서 비차단으로 링커 실행 → `factIds` 업데이트.
  Next 16의 비차단 실행 API(`after()` 등)는 구현 시
  `node_modules/next/dist/docs/`에서 확인 후 채택. 불가 시 `void promise` 패턴 폴백.

## 5. API

- `GET /api/questions?factId=xxx` — 해당 연표에 연결된 문제 목록(필터 추가, `getQuestions`에 `factId` 옵션).
- `GET /api/facts` — DTO에 `period/category/importance/keywords` + `questionCount`(연결 문제 수) 포함.
  `questionCount`는 전체 문제를 1회 로드해 메모리 집계(데이터셋 소규모 전제, 기존 패턴과 일치).
- `POST /api/admin/link-facts` — 위 일괄 연결(관리자 인증 필수).

## 6. UI

### 6.1 연표 페이지 `/timeline`
- 상세 패널: `category`·`importance` 배지 추가, **"관련 문제 N개 풀기"** 버튼(N>0일 때).
- 시대 열 내부에서 `period`별 소그룹 헤더로 세분화 시각화.
- 버튼 → `/study?factId=xxx` 이동.

### 6.2 학습 흐름 `/study?factId=xxx`
- 해당 factId로 연결 문제 조회 → **기존 `StudyRunner` 재사용**.
- 0개면 "연결된 문제가 아직 없습니다" 안내 + 연표로 복귀.

### 6.3 관리자 `/admin`
- `ManualForm`: 연표 멀티선택 피커(같은 era 기준 필터) 추가.
  AI 추천 프리필 버튼 + 수동 보정 가능. 저장 시 `factIds` 포함.
- 새 탭 "연표 연결": "미연결 자동연결"/"전체 재연결" 버튼 + 진행/결과 카운트.

## 7. 연표 콘텐츠 대량 집필

- `scripts/seed-timeline.ts`(또는 `prisma/`와 무관한 독립 스크립트) +
  구조화 TS 데이터: 9개 시대를 한능검 빈출 중심으로 세분화·보강.
- 멱등 upsert(기존 id 보존·신규 추가). `period/category/importance/keywords` 채움.
- 정확성 우선. 시대별 균형 있게 1차 약 150~200개 목표, 이후 점진 보강.
- 로컬에서 `.env.local` 자격증명으로 실행(기존 migrate 스크립트와 동일 패턴).

## 8. 비기능 요건 / 제약

- 기존 문서 비파괴(옵셔널 필드). 배포본(Cloud Run)에 영향 없는 점진 적용.
- AI 호출 비용: era 후보 한정으로 토큰 최소화. 일괄은 순차 처리.
- 보안: 일괄 연결·문제 생성은 관리자 인증(`isAdmin`) 필수.
- 빌드 제약: `next build`가 전체 `.ts`를 타입체크하므로 신규 스크립트는
  필요 시 tsconfig `exclude`에 추가(기존 seed 스크립트와 동일 처리).

## 9. 범위 밖 (YAGNI)

- 연표 항목의 풀 CMS(관리자 연표 CRUD 화면)는 이번 범위 밖 — 집필은 스크립트로 처리.
- 연표 간 그래프 시각화(`relatedTo` 네트워크)는 현행 유지.
- 자동 연결의 신뢰도 기반 수동 검수 큐는 범위 밖(추천+수동 보정으로 충분).

## 10. 작업 순서(개략)

1. 데이터 모델 확장(types/domain/firestore).
2. AI 링커 + 일괄 API + 신규 자동 연결.
3. 연표 콘텐츠 집필 스크립트 + upsert 실행(백필 데이터 준비).
4. `factId` 조회 API + `/study?factId` + 연표 상세 버튼.
5. 관리자 피커/일괄 탭.
6. 기존 74문제 일괄 백필 실행 + 검증.
