---
name: import-exam
description: "한국사능력검정시험 문제지(PDF/이미지)를 Claude Code가 직접 분석해 문제은행(Firestore)에 등록한다. Claude API 크레딧을 쓰지 않는다(vision Read + Node 스크립트). 사용자가 /import-exam 또는 '문제지 업로드/회차 추가/기출 등록'을 요청할 때 사용. 웹 관리자 업로드(/admin, 유료 API)의 크레딧-프리 대체 경로."
---

# /import-exam — Claude Code 문제지 임포트

웹 `/api/analyze`(유료 Claude API) 대신 **Claude Code 세션이 직접** 시험지를 분석해
문제은행에 등록하는 경로. 스키마·좌표 보정(snap)·저장은 웹 업로드와 동일 코드를 공유한다.

## 도구

- `npm run render:exam -- <pdf> --out _import/<회차>/pages [--pages 1-13] [--split]` — PDF→PNG (env 불필요)
- `npm run import:exam -- --dump-facts` — 연표 목록 (factIds 배정용)
- `npm run import:exam -- --json <f> --images <dir> --dry-run --out <dir>` — 검증·크롭 미리보기 (Firestore 접근 없음)
- `npm run import:exam -- --json <f> --images <dir> --upload [--replace-round] [--release "제목"]` — 실제 저장

작업 디렉터리는 `_import/<회차>/`(gitignore됨). 분석 JSON 형식은
`scripts/import-exam.ts` 상단 주석과 `src/lib/ai/schema.ts`(AnalyzeResult) 참조.

## 절차

### 1. 입력 접수
- PDF면: `npm run render:exam -- "<pdf경로>" --out _import/<회차>/pages --split`
  (2단 시험지는 `--split` 필수 — 좌/우 분할로 인식 해상도 2배. 산출: `pNN_L.png`/`pNN_R.png`)
- 이미지(PNG/JPG)면 그대로 사용. **답지(정답표) 파일 위치를 사용자에게 확인**한다.

### 2. 답지 먼저 정독 (정답의 유일한 출처)
- 정답표를 Read로 읽어 1~50번 정답 표를 만들고 **개수=문항수(보통 50) 자가검증**.
- 이후 모든 `answerIndex`(0-base)는 이 표에서만 결정하고 `answerSource: "답지"`로 기록.
- 답지가 없으면 한국사 지식으로 추정하되 `answerSource: "추정"` + 사용자에게 명시 고지.

### 3. 컬럼별 분석 → analysis.json 증분 작성
각 컬럼 이미지를 Read(vision)로 정독하며 `_import/<회차>/analysis.json`을 **컬럼 단위로
증분 저장**한다(세션 컨텍스트 소진 대비 — 중단해도 이어서 재개 가능).

- 최상위: `level`("SIMHWA"|"GIBON"), `examRound`, `examYear`, `images`(파일명 배열 —
  각 문항의 `imageSourceIndex`는 이 배열의 0-base 인덱스), `questions`
- 문항: `stem`·`passage` 원문 전사. 시각 자료가 있으면 `imageDescription` +
  `imageSourceIndex` + `questionBox`·`imageBox`·`scoreMarkerY`·`choicesTopY`.
  **좌표는 잉크 밴드 보정(snap)이 픽셀로 재확정하므로 위치 힌트 수준이면 충분** —
  단 `imageBox.y`는 삽화 상단에 최대한 가깝게(선지 클러스터 탐색 기준점).
- 그림 선지(사진·유물·탑 등)는 `choiceKind: "image"` + `choiceImages`(선지별 좌표),
  `choices`에는 식별 라벨(예: "경천사지 10층 석탑").
- `era`·`qType`은 `src/lib/domain.ts`의 키만 사용. 완료 후 자가검증: 문항 수, 선지 5개,
  answerIndex가 2단계 표와 일치.

### 4. (권장) 연표 factIds 배정
`npm run import:exam -- --dump-facts` 출력(id|era|year|title|keywords)을 읽고 문항별
`factIds`(최대 5)를 기입. **직접 관련만, 억지 연결 금지**. 생략하면 빈 배열로 저장되고
나중에 관리자 UI '연표 연결'(크레딧 필요)로 일괄 처리 가능.

### 5. dry-run 검수 루프 (필수)
```
npm run import:exam -- --json _import/<회차>/analysis.json --images _import/<회차>/pages --dry-run --out _import/<회차>/crops
```
`manifest.json`과 크롭 PNG를 Read로 **전량 검수**: 발문 삽화가 선지·다음 문항을 삼켰는지,
그림 선지 분할이 맞는지. 문제 발견 시:
1. 좌표 힌트(imageBox 등) 수정 후 재실행, 그래도 틀리면
2. **`figureBox`(수동 크롭 박스)를 문항에 지정** — snap·폴백을 건너뛰고 그대로 자르는
   탈출구. 텍스트 위주 삽화(책·사료)는 본문 줄이 선지로 오인될 수 있어 이 방법이 확실.
크롭이 전부 정상일 때까지 반복한다.

### 6. 사용자 승인 → 업로드
요약(문항 수·크롭 수·답지 대조 결과·같은 회차 기존 문항 유무)을 제시하고 **명시적 승인
후에만** `--upload` 실행. 같은 회차가 이미 있으면 스크립트가 중단하므로, 교체 여부를
사용자에게 물어 `--replace-round`(기존 전량 삭제 후 저장)를 결정한다.

### 7. 마무리
- 릴리스: `--release "제79회 심화 반영"` 또는 관리자 UI '업데이트 발행' 안내.
- 데이터만 변경되므로 **서버 재배포 불필요**. 라이브 확인:
  `curl "https://hanguksa-198132893049.asia-northeast3.run.app/api/questions?round=<회차>&limit=3"`
- factIds를 생략했다면 크레딧 복구 후 관리자 UI '연표 연결' 안내.

## 주의

- `--upload`는 프로덕션 Firestore에 쓴다(로컬 dev도 동일 DB). 승인 없이 실행 금지.
- `--replace-round`는 해당 회차·등급 기존 문항을 **전부 삭제**한다. 실행 전 개수 보고.
- 웹 업로드 경로(/admin)는 그대로 살아 있다 — 크레딧이 있으면 웹, 없으면 이 스킬.
