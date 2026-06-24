# 설계: 관계망 방향성 탐색기 (/network 심층 고도화)

- 작성일: 2026-06-25
- 대상 앱: hanguksa (Next.js 16 + Firebase, Cloud Run 배포)
- 상태: 승인됨 (사용자 확인 완료)

## 1. 배경과 목표

현재 `/network`는 모든 연표 항목을 `relatedTo`(무방향 자유텍스트) 기반으로 그리는
힘-기반(force-directed) 그래프다. 방향성이 없어 "이 사건이 역사 흐름의 어디에
있는지"를 직관적으로 보여주지 못한다.

목표: 연표를 대분류(시대)로 삼아 시작 사건을 고르고, 그 사건의 **이전(배경·원인)**과
**이후(결과·영향)** 관계를 좌→우 방향으로 보여주며, 관계를 따라 깊게(최대 100단계)
파고들 수 있는 **방향성 탐색기**로 개편한다.

## 2. 결정 사항 (브레인스토밍 합의)

| 항목 | 결정 |
|---|---|
| 방향(이전/이후) 데이터 | **AI 생성** `prevFactIds`/`nextFactIds` (연도 힌트 + 인과 판단) |
| 진입 방식 | **둘 다** — `/network`에서 시대→사건 선택 + `/timeline` 상세에서 직접 진입 |
| 기존 force graph | **방향 탐색기로 대체** (보존 안 함) |
| 시대 기준 | 연표 9개 시대 순서 (선사~현대) |
| 핵심 UX | 항목 상세 아래 이전/이후 관계를 보여 "흐름상 위치(map)"를 직관화 |

## 3. 데이터 모델 (Firestore)

### 3.1 Fact(연표) — 방향 필드 추가 (기존 문서 비파괴)

기존: `era, year, title, kind, body, relatedTo[], period, category, importance, keywords[]`

추가:
- `prevFactIds: string[]` — 이전(배경·원인) 연표 문서 id들. 기본 `[]`.
- `nextFactIds: string[]` — 이후(결과·영향) 연표 문서 id들. 기본 `[]`.

`FactDTO`(types.ts), `docToFact` 직렬화에 두 필드 반영(누락 시 `[]`).
seed 스크립트(`seed-timeline.ts`)의 `SeedFact`에도 옵셔널로 추가 가능(수동 시드용).

## 4. AI 방향 링커

`src/lib/ai/link-relations.ts` (서버 전용):
- 입력: 대상 fact(title·year·body·keywords·era) + **같은 era(±인접) 후보 facts**
  (id·title·year, 연도 오름차순).
- 모델: `CLAUDE_MODEL`(기본 Opus). tool 호출(JSON)로
  `{ prevFactIds: string[], nextFactIds: string[] }` 강제.
- 규칙(시스템 프롬프트): 이전=이 사건의 직접적 배경·원인이 된 사건, 이후=이 사건의
  직접적 결과·영향이 된 사건. 단지 같은 시대라는 이유로 넣지 않음(억지 연결 금지).
  연도는 강한 힌트(이전은 대개 더 이른 해, 이후는 더 늦은 해)이되, 인과가 우선.
- 정제(순수 함수, 테스트): 후보 id 화이트리스트 교집합, 자기 자신 제외,
  prev/next 중복 제거, 각 최대 N개(예: 5).

실행 경로:
- **관리자 일괄** `POST /api/admin/link-relations` `{ mode?: "missing" | "all" }`:
  - missing = prev/next 모두 빈 항목만, all = 전체. 순차 처리.
  - 결과 `{ processed, linked }` 반환. 관리자 인증 필수.
- **신규 자동**: 연표 seed/추가 후 일괄(missing) 백그라운드 실행(`after()`),
  응답 비차단. (연표는 자주 안 바뀌므로 일괄이 주 경로.)

## 5. API

- `GET /api/facts` — DTO에 `prevFactIds`/`nextFactIds` 포함.
  데이터셋이 작아(147개) 클라이언트가 전체를 보유하고 id→fact 로 해석한다(별도 무거운 엔드포인트 불필요).
- `POST /api/admin/link-relations` — 위 일괄 생성.

## 6. UI — `/network` 전면 개편 (방향 탐색기)

### 6.1 진입
- ⓐ `/network`: 상단 **시대 선택 바**(선사~현대 9개) → 그 시대 사건 목록 → 시작 사건 클릭.
- ⓑ `/timeline` 상세 패널에 **"이전·이후 관계 탐색"** 버튼 → `/network?factId=xxx` 로 진입.

### 6.2 중심 뷰 (방향 레이아웃)
- 가운데: 현재 사건 카드(제목·시대·연도·본문·`category`/`importance` 배지).
- 왼쪽 열: **이전(배경·원인)** 항목 카드들. 오른쪽 열: **이후(결과·영향)** 항목 카드들.
- 좌→우 화살표로 방향 표현. 항목이 없으면 "이전/이후 관계 없음" 안내.

### 6.3 상세 아래 관계 리스트 (요구 핵심)
- 현재 사건 본문 아래에 "이전 관계 / 이후 관계" 클릭 가능 목록을 명시적으로 표시 →
  "흐름상 위치"를 직관적으로 파악.

### 6.4 드릴다운 (최대 100단계)
- 이전/이후 항목 클릭 → 그 항목이 새 중심이 되어 뷰 재구성.
- 상단에 **이동 경로 breadcrumb**(방문한 사건들, 최대 100, 뒤로가기 가능).
- 경로 상한(100)은 순수 함수로 관리(테스트 대상).

### 6.5 학습 연계(보너스)
- 현재 사건에 연결된 문제(`questionCount>0`)가 있으면 "관련 문제 풀기"(`/study?factId=`) 버튼 노출.

## 7. 구현 범위 (파일)

- `src/lib/types.ts`: `FactDTO` += prev/next.
- `src/lib/firestore.ts`: `docToFact` prev/next 직렬화.
- `src/lib/ai/link-relations.ts`: 기존 `src/lib/ai/link-facts.ts`의 `candidateFacts` 재사용 + 신규 순수 헬퍼 `sanitizeRelations`(prev/next 정제) + Claude 호출 + 일괄.
- `src/lib/ai/link-relations.test.ts`: 순수 헬퍼 단위테스트.
- `src/app/api/admin/link-relations/route.ts`: 일괄 API.
- `src/components/admin/FactLinkPanel.tsx` 또는 신규 패널: "관계망 생성" 버튼 추가(또는 별 탭).
- `src/app/network/page.tsx`: 전면 개편(시대선택·방향뷰·관계리스트·breadcrumb, Suspense+useSearchParams로 `?factId=`).
- `src/app/timeline/page.tsx`: 상세에 "관계 탐색" 진입 버튼.
- 방향 관계 일괄 생성 실행(147개) — 프로덕션 Firestore.

## 8. 비기능 요건 / 제약

- 기존 문서 비파괴(옵셔널 필드). 점진 적용, 배포본 영향 없음.
- AI 비용: era 후보 한정으로 토큰 최소화, 일괄은 순차.
- 보안: 일괄 API는 `isAdmin` 필수.
- 빌드: `next build` 전체 타입체크 — 신규 스크립트는 tsconfig exclude(기존 패턴).
- `useSearchParams`는 Suspense로 감싼다(기존 `/study` 패턴과 동일).

## 9. 범위 밖 (YAGNI)

- force graph 보존/토글(대체하기로 결정).
- 연표 항목 CRUD 관리 화면(관계는 AI 일괄로 생성).
- 사용자가 직접 prev/next를 편집하는 UI(이번 범위 밖, 추후).

## 10. 작업 순서(개략)

1. 데이터 모델 확장(types/firestore) + factId 해석.
2. AI 방향 링커(순수 헬퍼 TDD + Claude + 일괄) + 관리자 API/버튼.
3. 방향 관계 일괄 생성 실행(147개).
4. `/network` 방향 탐색기 개편 + `/timeline` 진입 버튼.
5. 통합 검증(시대선택→중심뷰→이전/이후→드릴다운→breadcrumb).
