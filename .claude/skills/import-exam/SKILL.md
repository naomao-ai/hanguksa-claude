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
- `npm run import:exam -- --json <f> --images <dir> --dry-run --out <dir>` — 검증·크롭 미리보기 + **재검수 몽타주 자동 생성** (Firestore 접근 없음)
- `npm run import:exam -- --json <f> --images <dir> --update [--release "제목"]` — 같은 회차·번호 제자리 교체(비파괴)
- `npm run import:exam -- --json <f> --images <dir> --upload [--replace-round] [--release "제목"]` — 실제 저장

작업 디렉터리는 `_import/<회차>/`(gitignore됨). 분석 JSON 형식은
`scripts/import-exam.ts` 상단 주석과 `src/lib/ai/schema.ts`(AnalyzeResult) 참조.

**크롭·몽타주 산출물**: `--dry-run`·`--update`·`--upload` 모두 회차 폴더
`_import/<회차>/crops/`(또는 `--out`)에 문제 사진 `qNN_figure.png`·보기 사진
`qNN_choice_N.png`·`manifest.json`과, 재검수 시트 `montage_N.png`(발문 삽화 10문항/장)·
`choices_qNN.png`(그림 선지 5지 1행)를 정리 저장한다. 즉 **업로드 이후에도** 회차
폴더에서 이미지를 다시 검수할 수 있다(`--no-montage`로 시트 생략 가능).

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

### 5. dry-run 사진 재검수 루프 (필수 — 사진외 형상·잘림 자동 수정)
```
npm run import:exam -- --json _import/<회차>/analysis.json --images _import/<회차>/pages --dry-run --out _import/<회차>/crops
```
생성된 **재검수 몽타주를 Read(vision)로 전량 훑는다**:
- `montage_1.png`~`montage_N.png` — 문제(발문) 삽화 10문항씩. 각 삽화가 온전히,
  군더더기 없이 잘렸는지.
- `choices_qNN.png` — 그림 선지 문항의 5지가 한 줄로. 선지별 사진이 온전한지.

**두 가지 결함을 판정 기준으로 삼는다:**
1. **사진외 형상 포함** — 삽화 크롭에 선지 문장·발문·[N점] 배점·다음 문항 일부 등
   그림이 아닌 요소가 섞여 들어감. (특히 하단 첫 선지 줄, 상단 발문 줄이 흔한 오염원)
2. **사진 잘림** — 삽화·유물·지도·인물의 위/아래/좌/우가 잘려 형태가 온전하지 않음.
   (그림 선지 상단이 잘려 탑머리·인물 머리가 사라지는 경우가 흔함)

결함이 있는 문항은 **반드시 좌표를 고쳐 다시 만든다:**
1. 발문 삽화: `figureBox`(수동 크롭 박스)를 직접 지정 — snap·폴백을 건너뛰고 그대로
   자른다. 잘림이면 박스를 넓히고, 이물이 섞였으면 좁힌다. 텍스트 위주 삽화(책·사료·문서)는
   본문 줄이 선지로 오인될 수 있어 이 수동 지정이 가장 확실.
2. 그림 선지: `choiceImages[i].imageBox` 조정. 선지들이 붙어 있어 잉크 스냅이 인접 선지를
   물어오면 **문항에 `manualChoiceBoxes: true`** 를 준다 — 스냅과 안전 패딩을 모두
   건너뛰고 준 좌표를 그대로 자른다(figureBox와 같은 탈출구).
3. 수정 후 dry-run 재실행 → 해당 문항 크롭·몽타주만 다시 Read로 확인.

**좌표는 눈대중하지 말고 잉크 투영으로 실측하라.** 육안 추정은 수십 px씩 빗나가 잘림을
만든다(실측 예: 77회 #13 선지④ 실제 y=0.865인데 눈대중 0.827). 컬럼 이미지를
@napi-rs/canvas로 읽어 비-흰색 픽셀을 행/열로 투영하면 삽화·선지의 경계가 결정적으로 나온다.
`_import/77/measure-choices.mjs`(선지 격자)·`measure-figures.mjs`(가로 경계)·
`measure-v.mjs`(세로 밴드)가 참고 구현이다. 주의점 두 가지:
- **페이지 테두리 세로선**을 잉크로 잡으면 모든 문항이 컬럼 끝까지 잘린 것으로 오판된다 —
  폭이 2% 미만이면서 바깥 12%에 있는 얇은 그룹은 배제한다.
- **여러 밴드로 이뤄진 삽화**(문서카드+사진, 사료+연표, 포스터+사진)는 밴드 하나만 고르면
  나머지가 사라진다. 밴드 실측 결과는 반드시 크롭을 Read해 육안 확인한 뒤 채택한다.

**모든 문제·보기 사진이 사진외 형상 없이, 잘림 없이 온전할 때까지 이 루프를 반복**한다.
manifest의 `warnings`가 0이어도 눈으로 잘림·이물을 최종 확인해야 한다(경고는 크롭 실패만 잡음).

#### 5-1. 이미지 커버리지 게이트 (침묵 결손 차단 — 71회 심화 사고 재발 방지)
dry-run은 이제 **"삽화가 의도됐는데 크롭 imageUrl이 비어버린 문항"** 을 결정적으로 찾아
`❌ 이미지 결손 N건`으로 보고한다. 배경: `imageDescription`만 있고 `imageSourceIndex`·박스가
없으면 크롭이 **경고 하나 없이** null을 반환하고, 그런 문항은 **몽타주에서 아예 사라져** 시각
검수로는 안 보인다(71회 심화에서 31문항이 이렇게 이미지 없이 업로드됨). 판정 신호:
- **삽화 의도** = `figureBox`·`imageBox`·`imageSourceIndex`·`imageDescription` 중 하나라도 있음.
  이 중 하나라도 있는데 크롭 결과가 null이면 결손. (순수 텍스트 인용문 문항은 `passage`만 있고
  이 네 신호가 없으므로 걸리지 않는다.)
- **그림 선지 결손** = `choiceKind:"image"`인데 선지 이미지가 하나라도 비어 있음.

결손 문항은 몽타주에도 빨간 **MISSING 타일**로 나타난다. 해결:
- `imageSourceIndex`가 없어서 걸렸다면 → 그 값을 채우고(+필요 시 `imageBox`) dry-run 재실행.
- 좌표는 있는데 크롭이 빈다면 → `figureBox`(발문) 또는 `choiceImages[i].imageBox`(선지)를 실측해 지정.
- **삽화가 실제로 없는 문항**(imageDescription이 텍스트 서술뿐)이면 → `imageDescription`을 비운다.
- **결손이 0이 될 때까지 반복**한다. `--upload`/`--update`는 결손이 남아 있으면 **하드 차단**되며,
  검수로 의도적 예외임을 확인한 경우에만 `--allow-missing-images`로 강제할 수 있다.

#### 5-2. 데이터 정합성 게이트 (틀린 정답·번호 구멍 차단 — 우회 불가)
dry-run은 이미지와 별개로 **내용 정합성**도 검사해 `❌ 데이터 정합성 결함 N건`으로 보고한다.
스키마(zod)가 못 잡는 교차 제약을 본다:
- **answerIndex 범위**: `0 ≤ answerIndex < 선지수`가 아니면 결함. 답지 1-base를 0-base로 변환할 때의
  전형적 off-by-one(예: 정답 5번을 answerIndex 5로 저장 → 범위초과)을 잡는다. **프로덕션 정답 오류를
  막는 가장 중요한 게이트.**
- **문항 번호 집합**: 번호가 유일하고 1..N 연속이어야 함(누락·중복 검출). 전체 업로드에만 연속성 검사,
  `--update`(부분 교체)에는 유일성만 검사.
- **선지 개수 ≥2**, **그림선지 길이 일치**(`choiceImages.length == choices.length`).

`--allow-missing-images`로도 **우회되지 않는다**(이미지 예외와 달리 정합성 결함은 항상 하드 차단).
결함이 있으면 `analysis.json`을 고쳐 0건으로 만든 뒤 업로드한다.

### 6. 사용자 승인 → 업로드 (원자적 반영)
요약(문항 수·크롭 수·답지 대조 결과·재검수 통과 여부·같은 회차 기존 문항 유무)을 제시하고
**명시적 승인 후에만** `--upload` 실행. 같은 회차가 이미 있으면 스크립트가 중단하므로,
교체 여부를 사용자에게 물어 `--replace-round`를 결정한다.

**업로드는 원자적이다**(2026-07 강화): 이미지를 전부 먼저 Storage에 업로드한 뒤 Firestore
**단일 WriteBatch**로 커밋한다. `--replace-round`도 기존 삭제 + 신규 생성을 한 배치에 담아
all-or-nothing으로 교체하므로, 중간 실패(Storage 오류·중단·한도)에도 **기존 회차가 소실되거나
반쪽만 실리지 않는다**(과거 delete-first 파괴 경로 제거). Storage 업로드는 일시 오류 시 자동
재시도한다. 커밋 성공 후에만 구 이미지를 정리한다.
업로드 시 문제·보기 사진과 몽타주가 회차 폴더에 자동 저장되므로, 업로드 후 다시 한 번
몽타주를 Read로 확인해 최종 반영본에 잘림·이물이 없는지 검수한다. 결함이 남았으면
JSON을 고쳐 `--update`(제자리 교체, 비파괴)로 해당 문항만 다시 반영한다.

#### 6-1. 업로드 후 라이브 이미지 검증 (필수 — 로컬 크롭 성공 ≠ 프로덕션 반영)
로컬 크롭이 잡혔어도 `firestore.ts`의 Storage 업로드가 실패하면 imageUrl이 라이브에
안 실릴 수 있다. 업로드·릴리스 직후 반드시 프로덕션 API를 직접 조회해 확인한다:
```
node scripts/verify-live-images.mjs --round <N> --level <SIMHWA|GIBON>
```
이 검증은 이미지뿐 아니라 **회차 완결성**까지 본다: 문항 수(기본 50, `--count N`으로 조정),
번호 1..N 유일·연속, answerIndex 범위, 발문삽화·그림선지 imageUrl 커버리지.
- **exit 0(✅)** = 문항 수·번호 집합·answerIndex·이미지 전량 통과 → 그 (회차,등급) 완료.
- **exit 1(❌)** = 결함 목록 출력. **문항 수 불일치·번호 누락은 부분 업로드(반쪽 회차) 신호** —
  재업로드 필요. 발문삽화 결손은 `imageDescription`이 있는데 imageUrl이 없는 문항(라이브는
  imageBox·imageSourceIndex를 스트립하므로 imageDescription이 유일 신호)이라, 삽화가 실제로 없는
  문항이면 정상일 수 있으니 원본 대조. 진짜 결손이면 좌표 보강 후 `--update`로 재반영하고, 다시
  verify가 exit 0이 될 때까지 반복한다.

### 7. 마무리
- 릴리스: `--release "제79회 심화 반영"` 또는 관리자 UI '업데이트 발행' 안내.
- 데이터만 변경되므로 **서버 재배포 불필요**. 라이브 확인:
  `curl "https://hanguksa-198132893049.asia-northeast3.run.app/api/questions?round=<회차>&limit=3"`
- factIds를 생략했다면 크레딧 복구 후 관리자 UI '연표 연결' 안내.

## 주의

- `--upload`는 프로덕션 Firestore에 쓴다(로컬 dev도 동일 DB). 승인 없이 실행 금지.
- `--replace-round`는 해당 회차·등급 기존 문항을 **전부 삭제**한다. 실행 전 개수 보고.
- 웹 업로드 경로(/admin)는 그대로 살아 있다 — 크레딧이 있으면 웹, 없으면 이 스킬.
