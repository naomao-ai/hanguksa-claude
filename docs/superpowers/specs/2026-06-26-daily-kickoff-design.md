# 설계: 일일 출석 + 오늘의 랜덤 5문제 워밍업

- 작성일: 2026-06-26
- 대상 앱: hanguksa (Next.js 16 + Firebase)
- 상태: 승인됨 (사용자 확인 완료)

## 1. 목표

앱을 열 때마다 **누적 출석**을 체크해 동기를 부여하고, **오늘의 랜덤 5문제**로
가볍게 시작하도록 유도한다. 단, 풀이는 강제하지 않고 "건너뛰기"로 바로 공부 가능.
(수험생 평가의 "지속·동기부여" 축 보강.)

## 2. 결정 사항

- 출석은 **방문(앱 열기)** 기준 — 기존 `streak`(문제 풀이 기준)과 별개.
- 시작 팝업은 **하루 1회만** (오늘 첫 방문에만).
- 풀이는 선택: "5문제 풀기" 또는 "건너뛰기"(바로 공부).
- 계정 없음 유지 — localStorage 기반(기존 패턴).

## 3. 데이터 (`src/lib/local-store.ts`)

`Store`에 추가:
```
attendance: { lastDay: string | null; total: number; current: number; longest: number }
```
`emptyStore()` 기본값: `{ lastDay: null, total: 0, current: 0, longest: 0 }`.

순수 함수 `checkInToday(s: Store, day: string): Store`:
- `s.attendance.lastDay === day` 이면 변경 없이 그대로 반환(멱등).
- 아니면: `total+1`, `current = (lastDay가 day의 전날 ? current+1 : 1)`,
  `longest = max(longest, current)`, `lastDay = day`.
- `updateStreak`와 동일한 날짜 계산 방식(86,400,000ms diff) 사용.

## 4. 시작 팝업 (`src/components/DailyKickoff.tsx`)

- 클라이언트 컴포넌트. props: `attendance`(체크인 후 값), `onSolve()`, `onClose()`.
- 표시: "출석 완료! 🔥 누적 N일 · 연속 N일" + 동기 문구 + 오늘의 랜덤 5문제 안내.
- 버튼: **5문제 풀기**(`onSolve`) / **오늘은 건너뛰기**(`onClose`).
- 오버레이 스타일은 기존 `/timeline` 상세 패널 패턴 재사용(fixed inset-0, bg-black/40).

## 5. 홈 연동 (`src/app/page.tsx`)

- 마운트 시 `store.attendance.lastDay !== 오늘` 이면:
  `checkInToday`로 갱신 저장 + 팝업 표시(상태로 제어).
- "5문제 풀기" → `/study?warmup=1` 로 이동. "건너뛰기" → 팝업 닫기.
- 요약 지표에 **"누적 출석 N일"** 타일 1개 추가(상시 노출).

## 6. 워밍업 풀이 (`src/app/study/page.tsx`)

- `?warmup=1` 분기 추가(기존 `?factId=` 패턴과 동일): 랜덤 5문제 자동 로드 →
  기존 `StudyRunner` 재사용. 헤더에 "오늘의 워밍업" 표기 + 홈 복귀 링크.

## 7. 검증

- `checkInToday` 순수 함수 단위 테스트(`src/lib/local-store.test.ts`):
  첫 방문/연속/끊김/멱등 4케이스.
- `npm run build` 통과.
- 수동: 첫 방문 시 팝업 → 풀기(/study?warmup=1 5문제) / 건너뛰기 → 새로고침 시 재노출 안 됨(하루 1회).

## 8. 범위 밖 (YAGNI)

- 계정/서버 동기화(별도 P1 ③).
- 출석 보상 배지·연속 끊김 알림(추후).
- 문제 수 가변(고정 5문제).
