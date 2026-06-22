# 연표 세분화 + 문제–연표 AI 연결 + 연표 학습 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 한국사 연표를 세분화·보강하고, 각 연표 항목에 Claude로 분석한 관련 문제(`factIds`)를 연결해, 연표 상세에서 관련 문제를 바로 풀 수 있게 한다.

**Architecture:** Firestore의 `facts`(연표)에 분류 필드를 추가하고 `questions`에 `factIds[]`를 추가한다. 서버 전용 AI 링커가 같은 시대 후보 연표만으로 Claude를 호출해 `factIds`를 산출하며, 관리자 일괄 API와 신규 문제 저장 시 백그라운드로 실행된다. 연표 상세의 "관련 문제 풀기"는 `/study?factId=` 라우트에서 기존 `StudyRunner`를 재사용한다.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Firebase Admin (Firestore), `@anthropic-ai/sdk`(tool_use), Vitest, TailwindCSS 4.

## Global Constraints

- Next.js 버전: 16.2.9. **새 Next API(`after` 등)를 쓰기 전 반드시 `node_modules/next/dist/docs/`의 관련 문서를 먼저 읽는다** (AGENTS.md 규칙).
- 테스트: Vitest. 테스트 파일은 `src/**/*.test.ts`, 환경 `node`, `@`는 `src` 별칭. **Firestore·네트워크에 접근하지 않는 순수 함수만 단위 테스트로 작성**(기존 `srs.test.ts`/`scoring.test.ts` 패턴).
- AI 모델: `process.env.CLAUDE_MODEL || "claude-opus-4-8"`. 기존 `src/lib/ai/claude.ts`의 `client()`·tool_use 패턴을 재사용.
- 기존 Firestore 문서 비파괴: 새 필드는 모두 옵셔널. 누락 시 기본값(`[]`/`null`)으로 직렬화.
- 쓰기/일괄 API는 `isAdmin(req)`(`src/lib/admin.ts`) 통과 시에만 허용.
- 빌드 제약: `next build`는 프로젝트 전체 `.ts`를 타입체크. 로컬 전용 스크립트(`scripts/seed-timeline.ts`)는 `tsconfig.json` `exclude`에 추가.
- 시대 키(순서): `prehistoric, gojoseon, samguk, nambukguk, goryeo, joseon, modern, japanese, contemporary` (`ERAS` in `src/lib/domain.ts`).
- 커밋 메시지 말미: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- 로컬 개발 서버 기동/확인 명령: `npm run dev`(포트 3000), 빌드 확인 `npm run build`.

---

## File Structure

생성:
- `src/lib/ai/link-facts.ts` — 순수 헬퍼(`candidateFacts`, `sanitizeFactIds`) + 비동기 `linkQuestionToFacts` + 배치 `linkAllQuestions`.
- `src/lib/ai/link-facts.test.ts` — 순수 헬퍼 단위 테스트.
- `src/lib/domain.test.ts` — `adjacentEras`, `FACT_CATEGORIES` 단위 테스트.
- `src/app/api/admin/link-facts/route.ts` — 관리자 일괄 연결 POST.
- `src/components/admin/FactLinkPanel.tsx` — 관리자 "연표 연결" 탭 UI.
- `scripts/seed-timeline.ts` — 세분화 연표 데이터 + 멱등 upsert 스크립트.

수정:
- `src/lib/domain.ts` — `FACT_CATEGORIES`, `adjacentEras()` 추가.
- `src/lib/types.ts` — `FactDTO`에 분류 필드 4종, `QuestionDTO`에 `factIds`.
- `src/lib/firestore.ts` — `docToFact`/`docToQuestion`/`buildQuestionDoc`/`NewQuestion` 확장, `getQuestions` `factId` 필터, `getFacts` `questionCount`, 신규 `setQuestionFactIds`/`getQuestionsForLinking`.
- `src/lib/api.ts` — `QuestionFilter.factId`, `fetchQuestions` 반영.
- `src/app/api/questions/route.ts` — GET `factId` 파싱 + POST 후 백그라운드 링크.
- `src/app/api/questions/bulk/route.ts` — 저장 후 백그라운드 링크.
- `src/app/study/page.tsx` — `?factId=` 자동 시작 지원.
- `src/app/timeline/page.tsx` — 분류 배지 + "관련 문제 풀기" 버튼 + period 소그룹.
- `src/components/admin/ManualForm.tsx` — 연표 멀티선택 피커.
- `src/app/admin/page.tsx` — "연표 연결" 탭 추가.
- `package.json` — `seed:timeline` 스크립트.
- `tsconfig.json` — `scripts/seed-timeline.ts` exclude.

---

## Task 1: 도메인 상수 — 연표 분류·시대 인접

**Files:**
- Modify: `src/lib/domain.ts`
- Test: `src/lib/domain.test.ts`

**Interfaces:**
- Produces:
  - `FACT_CATEGORIES: readonly string[]` — `["정치","경제","사회","문화","대외관계"]`
  - `adjacentEras(eraKey: string): string[]` — 자신 + 직전·직후 시대 키(존재하는 것만). 알 수 없는 키면 `[]`.

- [ ] **Step 1: Write the failing test**

`src/lib/domain.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { adjacentEras, FACT_CATEGORIES, ERA_KEYS } from "./domain";

describe("adjacentEras", () => {
  it("중간 시대는 직전·자신·직후 3개", () => {
    expect(adjacentEras("goryeo")).toEqual(["nambukguk", "goryeo", "joseon"]);
  });
  it("첫 시대는 자신·직후 2개", () => {
    expect(adjacentEras("prehistoric")).toEqual(["prehistoric", "gojoseon"]);
  });
  it("마지막 시대는 직전·자신 2개", () => {
    expect(adjacentEras("contemporary")).toEqual(["japanese", "contemporary"]);
  });
  it("알 수 없는 키는 빈 배열", () => {
    expect(adjacentEras("unknown")).toEqual([]);
  });
});

describe("FACT_CATEGORIES", () => {
  it("5개 주제 분류", () => {
    expect(FACT_CATEGORIES).toEqual(["정치", "경제", "사회", "문화", "대외관계"]);
  });
  it("모든 시대 키가 9개", () => {
    expect(ERA_KEYS).toHaveLength(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/domain.test.ts`
Expected: FAIL — `adjacentEras`/`FACT_CATEGORIES` is not exported.

- [ ] **Step 3: Add the constants and helper**

`src/lib/domain.ts` — `ERA_KEYS` 정의(40번째 줄 부근) 바로 아래에 추가:
```typescript
/** 연표 항목 주제 분류 */
export const FACT_CATEGORIES = ["정치", "경제", "사회", "문화", "대외관계"] as const;

/** 한 시대와 시간상 인접한(직전·자신·직후) 시대 키. AI 연결 후보 범위 산정용. */
export function adjacentEras(eraKey: string): string[] {
  const i = ERA_KEYS.indexOf(eraKey);
  if (i < 0) return [];
  return ERA_KEYS.slice(Math.max(0, i - 1), i + 2);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/domain.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/domain.ts src/lib/domain.test.ts
git commit -m "feat: 연표 분류 상수·시대 인접 헬퍼 추가

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: 타입 확장 — FactDTO 분류 필드 + QuestionDTO factIds

**Files:**
- Modify: `src/lib/types.ts`

**Interfaces:**
- Produces:
  - `FactDTO` += `period: string | null`, `category: string | null`, `importance: number | null`, `keywords: string[]`, `questionCount?: number`.
  - `QuestionDTO` += `factIds: string[]`.

- [ ] **Step 1: Extend FactDTO**

`src/lib/types.ts` — `FactDTO` 인터페이스를 아래로 교체:
```typescript
export interface FactDTO {
  id: string;
  era: string;
  year: number | null;
  title: string;
  kind: string;
  body: string;
  relatedTo: string[];
  /** 소시대/세부 시기 (예: "삼국-전성기") */
  period: string | null;
  /** 주제 분류: 정치/경제/사회/문화/대외관계 */
  category: string | null;
  /** 빈출·중요도 1~3 */
  importance: number | null;
  /** 문제 매칭·검색용 핵심어 */
  keywords: string[];
  /** 이 연표에 연결된 문제 수 (getFacts가 채움) */
  questionCount?: number;
}
```

- [ ] **Step 2: Add factIds to QuestionDTO**

`src/lib/types.ts` — `QuestionDTO`의 `choices` 줄 바로 위에 추가:
```typescript
  /** 연결된 연표(facts) 문서 ID 배열 */
  factIds: string[];
```

- [ ] **Step 3: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: 새 필드로 인한 에러가 firestore.ts 등에서 발생할 수 있음 — Task 3에서 채움. 이 단계에서는 **`types.ts` 자체에 문법 오류가 없음**만 확인(에러가 firestore.ts/timeline 등 소비처에 한정되면 정상).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: FactDTO 분류 필드·QuestionDTO factIds 타입 추가

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Firestore 계층 — 직렬화·필터·연결 쓰기

**Files:**
- Modify: `src/lib/firestore.ts`

**Interfaces:**
- Consumes: `FactDTO`, `QuestionDTO`(Task 2), `adjacentEras`(Task 1).
- Produces:
  - `docToFact` → 새 필드 직렬화.
  - `docToQuestion` → `factIds` 직렬화.
  - `buildQuestionDoc`/`NewQuestion` → `factIds` 저장.
  - `QuestionFilter.factId?: string` + `getQuestions`가 `factId`로 필터.
  - `getFacts` 결과의 각 fact에 `questionCount` 포함.
  - `setQuestionFactIds(id: string, factIds: string[]): Promise<void>`
  - `getQuestionsForLinking(mode: "missing" | "all"): Promise<QuestionDTO[]>`

- [ ] **Step 1: docToFact에 새 필드 추가**

`src/lib/firestore.ts`의 `docToFact` 함수를 아래로 교체:
```typescript
function docToFact(id: string, d: FirebaseFirestore.DocumentData): FactDTO {
  return {
    id,
    era: d.era,
    year: d.year ?? null,
    title: d.title,
    kind: d.kind ?? "event",
    body: d.body ?? "",
    relatedTo: Array.isArray(d.relatedTo) ? d.relatedTo : [],
    period: d.period ?? null,
    category: d.category ?? null,
    importance: typeof d.importance === "number" ? d.importance : null,
    keywords: Array.isArray(d.keywords) ? d.keywords : [],
  };
}
```

- [ ] **Step 2: docToQuestion에 factIds 추가**

`docToQuestion`의 `return { ... }` 객체에서 `choices:` 줄 바로 위에 추가:
```typescript
    factIds: Array.isArray(d.factIds) ? d.factIds : [],
```

- [ ] **Step 3: NewQuestion·buildQuestionDoc에 factIds 추가**

`NewQuestion` 인터페이스에 추가:
```typescript
  factIds?: string[];
```
`buildQuestionDoc`의 반환 객체에서 `createdAt:` 줄 바로 위에 추가:
```typescript
    factIds: Array.isArray(q.factIds) ? q.factIds : [],
```

- [ ] **Step 4: QuestionFilter·getQuestions에 factId 필터 추가**

`QuestionFilter` 인터페이스에 추가:
```typescript
  factId?: string;
```
`getQuestions` 안에서 `if (f.topic)` 필터 블록 바로 위에 추가:
```typescript
  if (f.factId) rows = rows.filter((r) => r.factIds.includes(f.factId!));
```

- [ ] **Step 5: getFacts에 questionCount 채우기**

`getFacts` 함수를 아래로 교체:
```typescript
export async function getFacts(era?: string | null, kind?: string | null): Promise<FactDTO[]> {
  const [factSnap, allQ] = await Promise.all([
    db.collection(COL.facts).get(),
    getAllQuestions(),
  ]);
  const counts = new Map<string, number>();
  for (const q of allQ) for (const fid of q.factIds) counts.set(fid, (counts.get(fid) ?? 0) + 1);

  let rows = factSnap.docs.map((d) => {
    const f = docToFact(d.id, d.data());
    return { ...f, questionCount: counts.get(f.id) ?? 0 };
  });
  if (era) rows = rows.filter((r) => r.era === era);
  if (kind) rows = rows.filter((r) => r.kind === kind);
  return rows.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}
```

- [ ] **Step 6: 연결 쓰기·조회 함수 추가**

`src/lib/firestore.ts`의 Question 영역 끝(예: `latestRound` 함수 뒤)에 추가:
```typescript
/** 문항의 factIds 갱신 (AI 연결용) */
export async function setQuestionFactIds(id: string, factIds: string[]): Promise<void> {
  await db.collection(COL.questions).doc(id).update({ factIds });
}

/** 연결 대상 문항 조회. missing=factIds 비어있는 것만, all=전체 */
export async function getQuestionsForLinking(
  mode: "missing" | "all"
): Promise<QuestionDTO[]> {
  const rows = await getAllQuestions();
  return mode === "all" ? rows : rows.filter((r) => r.factIds.length === 0);
}
```

- [ ] **Step 7: 전체 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS (timeline/admin 등 UI 소비처가 새 FactDTO 필드를 아직 안 쓰면 에러 없음 — 필드는 추가만 됨).

- [ ] **Step 8: Commit**

```bash
git add src/lib/firestore.ts
git commit -m "feat: Firestore 연표 분류·문제 factIds 직렬화·필터·연결 쓰기

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: AI 링커 순수 헬퍼 (TDD)

**Files:**
- Create: `src/lib/ai/link-facts.ts`
- Create: `src/lib/ai/link-facts.test.ts`

**Interfaces:**
- Consumes: `adjacentEras`(Task 1), `FactDTO`/`QuestionDTO`(Task 2).
- Produces:
  - `candidateFacts(question: QuestionDTO, allFacts: FactDTO[]): FactDTO[]` — 문제 era의 인접 시대에 속하는 facts만(최대 60개, year 오름차순).
  - `sanitizeFactIds(returned: unknown, candidateIds: string[], max?: number): string[]` — 후보 화이트리스트 교집합, 중복 제거, 최대 `max`(기본 5)개.

- [ ] **Step 1: Write the failing test**

`src/lib/ai/link-facts.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { candidateFacts, sanitizeFactIds } from "./link-facts";
import type { FactDTO, QuestionDTO } from "@/lib/types";

function fact(id: string, era: string, year: number): FactDTO {
  return { id, era, year, title: id, kind: "event", body: "", relatedTo: [], period: null, category: null, importance: null, keywords: [] };
}
function question(era: string): QuestionDTO {
  return { id: "q1", level: "SIMHWA", examRound: null, examYear: null, number: null, stem: "", passage: null, imageUrl: null, imageDescription: null, explanation: null, answerIndex: 0, era, topics: [], qType: "기타", difficulty: null, source: "MANUAL", factIds: [], choices: [] };
}

describe("candidateFacts", () => {
  it("문제 era의 인접 시대 facts만 포함", () => {
    const facts = [fact("a", "samguk", 500), fact("b", "goryeo", 1000), fact("c", "joseon", 1500), fact("d", "modern", 1880)];
    const res = candidateFacts(question("goryeo"), facts);
    expect(res.map((f) => f.id).sort()).toEqual(["a", "b", "c"]); // nambukguk/goryeo/joseon 인접
  });
  it("year 오름차순 정렬", () => {
    const facts = [fact("late", "goryeo", 1300), fact("early", "goryeo", 950)];
    expect(candidateFacts(question("goryeo"), facts).map((f) => f.id)).toEqual(["early", "late"]);
  });
});

describe("sanitizeFactIds", () => {
  it("후보에 없는 id는 제거", () => {
    expect(sanitizeFactIds(["a", "x"], ["a", "b"])).toEqual(["a"]);
  });
  it("중복 제거 + 최대 개수 제한", () => {
    expect(sanitizeFactIds(["a", "a", "b", "c"], ["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
  it("배열이 아니면 빈 배열", () => {
    expect(sanitizeFactIds("nope", ["a"])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/link-facts.test.ts`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 3: Implement the pure helpers**

`src/lib/ai/link-facts.ts`:
```typescript
import { adjacentEras } from "@/lib/domain";
import type { FactDTO, QuestionDTO } from "@/lib/types";

const MAX_CANDIDATES = 60;
const MAX_LINKS = 5;

/** 문제 era의 인접 시대 facts만 추려 후보로 반환 (year 오름차순, 상한 적용). */
export function candidateFacts(question: QuestionDTO, allFacts: FactDTO[]): FactDTO[] {
  const eras = new Set(adjacentEras(question.era));
  return allFacts
    .filter((f) => eras.has(f.era))
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    .slice(0, MAX_CANDIDATES);
}

/** AI 반환값을 후보 화이트리스트로 정제: 교집합·중복제거·상한. */
export function sanitizeFactIds(
  returned: unknown,
  candidateIds: string[],
  max: number = MAX_LINKS
): string[] {
  if (!Array.isArray(returned)) return [];
  const allow = new Set(candidateIds);
  const out: string[] = [];
  for (const v of returned) {
    if (typeof v === "string" && allow.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/link-facts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/link-facts.ts src/lib/ai/link-facts.test.ts
git commit -m "feat: AI 연결 순수 헬퍼(candidateFacts·sanitizeFactIds) + 테스트

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: AI 링커 Claude 호출 + 배치

**Files:**
- Modify: `src/lib/ai/link-facts.ts`

**Interfaces:**
- Consumes: `candidateFacts`/`sanitizeFactIds`(Task 4), `client()` 패턴(`src/lib/ai/claude.ts`), `getAllQuestions`/`getFacts`/`setQuestionFactIds`(Task 3).
- Produces:
  - `linkQuestionToFacts(question: QuestionDTO, allFacts: FactDTO[]): Promise<string[]>` — Claude로 factIds 산출(후보 없으면 빈 배열, 실패 시 빈 배열).
  - `linkAllQuestions(mode: "missing" | "all"): Promise<{ processed: number; linked: number }>` — 일괄 실행(순차).
  - `linkOneById(questionId: string): Promise<void>` — 단건 백그라운드용.

- [ ] **Step 1: Claude 클라이언트 공유**

`src/lib/ai/claude.ts` 상단의 `client()`는 모듈 내부 전용이다. 중복 생성을 피하려고 `link-facts.ts`에서 자체 클라이언트를 만든다. `src/lib/ai/link-facts.ts` 상단 import에 추가:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { getAllQuestions, getFacts, setQuestionFactIds } from "@/lib/firestore";

const MODEL = process.env.CLAUDE_MODEL || "claude-opus-4-8";
let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) {
    if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY 미설정");
    _client = new Anthropic();
  }
  return _client;
}
```

- [ ] **Step 2: linkQuestionToFacts 구현**

`src/lib/ai/link-facts.ts` 끝에 추가:
```typescript
const LINK_TOOL = {
  name: "select_facts",
  description: "문제와 직접 관련된 연표 항목 id들을 선택한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      factIds: {
        type: "array",
        items: { type: "string" },
        description: "관련 연표의 id 배열. 직접 관련된 것만. 없으면 빈 배열. 최대 5개.",
      },
    },
    required: ["factIds"],
  },
};

const LINK_SYSTEM = `당신은 한국사능력검정시험 문제와 한국사 연표를 연결하는 전문가입니다.
주어진 문제가 다루는 사건·인물·제도와 직접 관련된 연표 항목만 고릅니다.
- 같은 주제를 다루거나 문제 풀이에 직접 도움이 되는 항목만 선택합니다.
- 단지 같은 시대라는 이유로 무관한 항목을 넣지 않습니다(억지 연결 금지).
- 관련 항목이 없으면 빈 배열을 반환합니다. 반드시 select_facts 도구를 호출합니다.`;

/** 단일 문제에 대해 Claude로 관련 factIds 산출. 실패·후보없음 시 빈 배열. */
export async function linkQuestionToFacts(
  question: QuestionDTO,
  allFacts: FactDTO[]
): Promise<string[]> {
  const cands = candidateFacts(question, allFacts);
  if (cands.length === 0) return [];
  const candidateList = cands
    .map((f) => `- id:${f.id} | ${f.year ?? "?"} | ${f.title} | ${f.keywords.join(",")}`)
    .join("\n");
  const userText =
    `[문제]\n발문: ${question.stem}\n` +
    (question.passage ? `자료: ${question.passage}\n` : "") +
    (question.imageDescription ? `시각자료: ${question.imageDescription}\n` : "") +
    `주제태그: ${question.topics.join(", ")}\n시대: ${question.era}\n` +
    (question.explanation ? `해설: ${question.explanation}\n` : "") +
    `\n[연표 후보]\n${candidateList}\n\n관련 연표 id를 select_facts로 반환하세요.`;

  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 300,
      system: LINK_SYSTEM,
      tools: [LINK_TOOL],
      tool_choice: { type: "tool", name: "select_facts" },
      messages: [{ role: "user", content: userText }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    const input = block && block.type === "tool_use" ? (block.input as { factIds?: unknown }) : {};
    return sanitizeFactIds(input.factIds, cands.map((f) => f.id));
  } catch {
    return [];
  }
}

/** 단건 연결(백그라운드용): id로 문제·연표를 로드해 factIds 갱신. */
export async function linkOneById(questionId: string): Promise<void> {
  const [allFacts, allQ] = await Promise.all([getFacts(), getAllQuestions()]);
  const q = allQ.find((x) => x.id === questionId);
  if (!q) return;
  const factIds = await linkQuestionToFacts(q, allFacts);
  if (factIds.length > 0) await setQuestionFactIds(q.id, factIds);
}

/** 일괄 연결: missing=미연결만, all=전체. 순차 처리. */
export async function linkAllQuestions(
  mode: "missing" | "all"
): Promise<{ processed: number; linked: number }> {
  const allFacts = await getFacts();
  const targets = (await getAllQuestions()).filter(
    (q) => mode === "all" || q.factIds.length === 0
  );
  let linked = 0;
  for (const q of targets) {
    const factIds = await linkQuestionToFacts(q, allFacts);
    await setQuestionFactIds(q.id, factIds);
    if (factIds.length > 0) linked++;
  }
  return { processed: targets.length, linked };
}
```

참고: `getFacts()`가 반환하는 `FactDTO`에는 `keywords`가 포함된다(Task 3). `getFacts`는 `questionCount`도 채우지만 링커는 사용하지 않는다.

- [ ] **Step 3: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: 순수 헬퍼 회귀 테스트**

Run: `npx vitest run src/lib/ai/link-facts.test.ts`
Expected: PASS (Task 4 테스트 그대로 통과 — Claude 호출부는 테스트 안 함).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/link-facts.ts
git commit -m "feat: Claude 기반 문제-연표 연결(linkQuestionToFacts·linkAllQuestions·linkOneById)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: 관리자 일괄 연결 API

**Files:**
- Create: `src/app/api/admin/link-facts/route.ts`

**Interfaces:**
- Consumes: `isAdmin`(`src/lib/admin.ts`), `linkAllQuestions`(Task 5).
- Produces: `POST /api/admin/link-facts` body `{ mode?: "missing" | "all" }` → `{ processed, linked }`.

- [ ] **Step 1: 라우트 구현**

`src/app/api/admin/link-facts/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { linkAllQuestions } from "@/lib/ai/link-facts";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/link-facts { mode?: "missing" | "all" }
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "all" ? "all" : "missing";
  try {
    const result = await linkAllQuestions(mode);
    return NextResponse.json(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const status = /ANTHROPIC_API_KEY/.test(raw) ? 503 : 500;
    return NextResponse.json({ error: "연결 처리 중 오류: " + raw }, { status });
  }
}
```

- [ ] **Step 2: 빌드로 라우트 컴파일 확인**

Run: `npm run build`
Expected: 라우트 목록에 `ƒ /api/admin/link-facts` 표시, 빌드 PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/link-facts/route.ts
git commit -m "feat: 관리자 일괄 문제-연표 연결 API

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: 신규 문제 저장 시 백그라운드 자동 연결

**Files:**
- Modify: `src/app/api/questions/route.ts`
- Modify: `src/app/api/questions/bulk/route.ts`

**Interfaces:**
- Consumes: `linkOneById`(Task 5), `linkAllQuestions` 패턴.
- Produces: 문제 저장 응답은 즉시 반환, 연결은 백그라운드 실행.

- [ ] **Step 1: Next 16 백그라운드 API 확인**

Run: `ls node_modules/next/dist/docs/` 후 `after`/background 관련 문서를 Read로 확인.
- `unstable_after`/`after`가 `next/server`에 있으면 사용. 없거나 불명확하면 **폴백**: 응답 직전에 `void promise.catch(() => {})`로 fire-and-forget(요청 핸들러가 반환해도 Node 프로세스가 살아있는 한 진행). Cloud Run은 요청 처리 중 CPU 할당이므로, 확실성을 위해 `after`가 있으면 우선 사용.

- [ ] **Step 2: 단일 생성 라우트에 백그라운드 연결 추가**

`src/app/api/questions/route.ts`:
- 상단 import에 추가:
```typescript
import { linkOneById } from "@/lib/ai/link-facts";
```
- POST 함수에서 `const question = await createQuestion({ ... });` 직후, `return` 직전에 추가:
```typescript
  // 백그라운드 연결 (응답 비차단). 실패는 무시(관리자 일괄로 보완 가능).
  void linkOneById(question.id).catch(() => {});
```

- [ ] **Step 3: bulk 라우트에 백그라운드 연결 추가**

`src/app/api/questions/bulk/route.ts`:
- 상단 import에 추가:
```typescript
import { linkAllQuestions } from "@/lib/ai/link-facts";
```
- `const created = await createQuestions(items);` 직후, `return` 직전에 추가:
```typescript
  // 방금 추가된(미연결) 문제들을 백그라운드로 연결. 응답 비차단.
  void linkAllQuestions("missing").catch(() => {});
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/questions/route.ts src/app/api/questions/bulk/route.ts
git commit -m "feat: 신규 문제 저장 시 백그라운드 연표 자동연결

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: factId 조회 API + 클라이언트 fetch

**Files:**
- Modify: `src/app/api/questions/route.ts`
- Modify: `src/lib/api.ts`

**Interfaces:**
- Consumes: `getQuestions`의 `factId` 필터(Task 3).
- Produces: `GET /api/questions?factId=xxx`; `QuestionFilter.factId`; `fetchQuestions` 반영.

- [ ] **Step 1: GET에서 factId 파싱**

`src/app/api/questions/route.ts`의 GET 함수에서 `const era = ...` 줄들 근처에 추가:
```typescript
  const factId = sp.get("factId") || undefined;
```
그리고 `getQuestions({ ... })` 호출 객체에 `factId,` 추가.

- [ ] **Step 2: 클라이언트 fetch에 factId 추가**

`src/lib/api.ts`:
- `QuestionFilter`에 추가:
```typescript
  factId?: string;
```
- `fetchQuestions` 안 `if (f.q) sp.set("q", f.q);` 아래에 추가:
```typescript
  if (f.factId) sp.set("factId", f.factId);
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/questions/route.ts src/lib/api.ts
git commit -m "feat: factId로 연결된 문제 조회 API·클라이언트

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: 연표 콘텐츠 세분화 데이터 + upsert 스크립트

**Files:**
- Create: `scripts/seed-timeline.ts`
- Modify: `package.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: `db`(`src/lib/firebase-admin.ts`), `Timestamp`.
- Produces: `npm run seed:timeline`이 세분화 연표를 Firestore `facts`에 멱등 upsert.

- [ ] **Step 1: 스크립트 스캐폴드 + 소규모 데이터로 시작**

`scripts/seed-timeline.ts`:
```typescript
/**
 * 세분화 한국사 연표 upsert (멱등). 기존 facts에 신규 추가/보강.
 * 실행: npm run seed:timeline  (.env.local 자격증명 필요)
 * 안정 id(slug) 사용 → 재실행 시 덮어씀(중복 생성 없음).
 */
import { Timestamp } from "firebase-admin/firestore";
import { db } from "../src/lib/firebase-admin.ts";

interface SeedFact {
  slug: string;          // 안정 문서 id (예: "goryeo-918-건국")
  era: string;
  year: number | null;
  title: string;
  kind: string;          // event | person | system | culture | war | foreign
  period: string | null;
  category: string;      // 정치/경제/사회/문화/대외관계
  importance: number;    // 1~3
  body: string;
  keywords: string[];
  relatedTo?: string[];
}

const FACTS: SeedFact[] = [
  // 예시 1건 — 실제 데이터는 시대별로 충실히 작성(약 150~200개 목표)
  {
    slug: "goryeo-918-건국",
    era: "goryeo",
    year: 918,
    title: "고려 건국",
    kind: "event",
    period: "고려-초기",
    category: "정치",
    importance: 3,
    body: "왕건이 궁예를 몰아내고 송악(개경)을 도읍으로 고려를 건국하였다.",
    keywords: ["왕건", "태조", "개경", "후삼국"],
    relatedTo: ["후삼국 통일"],
  },
];

async function main() {
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error("환경변수 미설정(.env.local). FIREBASE_STORAGE_BUCKET 필요.");
  }
  let upserted = 0;
  for (const f of FACTS) {
    const { slug, ...rest } = f;
    await db.collection("facts").doc(slug).set(
      { ...rest, relatedTo: rest.relatedTo ?? [], createdAt: Timestamp.now() },
      { merge: true }
    );
    upserted++;
  }
  console.log(`연표 upsert 완료: ${upserted}건`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: package.json 스크립트 추가**

`package.json`의 `scripts`에 추가(기존 `migrate:firebase`와 동일 실행 방식):
```json
    "seed:timeline": "node --env-file=.env.local --experimental-strip-types scripts/seed-timeline.ts",
```

- [ ] **Step 3: tsconfig exclude 추가**

`tsconfig.json`의 `exclude` 배열에 추가:
```json
    "scripts/seed-timeline.ts",
```

- [ ] **Step 4: 데이터 집필 — 시대별 세분화**

`FACTS` 배열을 시대 순서(`prehistoric`→`contemporary`)로 채운다. 시대별 지침:
- 각 시대 핵심 사건·인물·제도·문화·대외관계를 한능검 빈출 기준으로 세분화.
- `slug`는 `<era>-<year>-<핵심어>` 형식의 안정 키(중복 금지).
- `importance`: 최빈출=3, 빈출=2, 보조=1.
- `category`는 `FACT_CATEGORIES`(정치/경제/사회/문화/대외관계) 중 하나.
- `keywords`에는 문제의 `topics`와 매칭될 인물·사건·제도명을 충분히 포함(연결 정확도 핵심).
- 1차 목표 총 150~200건. **정확성 우선** — 불확실한 연도/사실은 넣지 않는다.
- 시대별 균형(각 시대 최소 10건 이상 권장).

> 집필 분량이 크므로, 이 Step은 시대 단위로 나누어 진행하고 시대 1개 채울 때마다 다음 Step의 빌드/타입체크로 검증한다.

- [ ] **Step 5: 타입체크(스크립트는 빌드 제외이므로 직접 확인)**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: PASS(스크립트는 exclude되어 영향 없음). 추가로 데이터 문법 확인: `node --check`는 TS라 불가하므로 다음 Step의 실제 실행으로 검증.

- [ ] **Step 6: 멱등 upsert 실행**

Run: `npm run seed:timeline`
Expected: `연표 upsert 완료: N건` 출력, 에러 없음.

- [ ] **Step 7: 데이터 검증**

Run: `curl -s "http://localhost:3000/api/facts?era=goryeo" | python -c "import sys,json; d=json.load(sys.stdin)['facts']; print(len(d),'건'); print(d[0])"`
(사전에 `npm run dev` 필요)
Expected: 새 필드(`period/category/importance/keywords`)가 채워진 facts 반환.

- [ ] **Step 8: Commit**

```bash
git add scripts/seed-timeline.ts package.json tsconfig.json
git commit -m "feat: 세분화 한국사 연표 데이터·멱등 upsert 스크립트

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: 연표 학습 라우트 — /study?factId=

**Files:**
- Modify: `src/app/study/page.tsx`

**Interfaces:**
- Consumes: `fetchQuestions({ factId })`(Task 8), `fetchFacts`(연표 제목 표시), `StudyRunner`.
- Produces: `/study?factId=xxx` 접근 시 해당 연표 연결 문제로 자동 학습 시작.

- [ ] **Step 1: useSearchParams로 factId 자동 시작 추가**

`src/app/study/page.tsx`를 수정:
- 상단 import 교체/추가:
```typescript
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { fetchFacts } from "@/lib/api";
```
- 기존 `export default function StudyPage()`를 내부 컴포넌트로 감싸고 Suspense로 래핑(useSearchParams 요구사항). 파일 하단에 래퍼 추가:
```typescript
export default function StudyPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>}>
      <StudyPage />
    </Suspense>
  );
}
```
그리고 기존 `export default function StudyPage()`를 `function StudyPage()`로 변경.
- `StudyPage` 본문 상단(상태 선언부 아래)에 factId 자동 시작 추가:
```typescript
  const params = useSearchParams();
  const factId = params.get("factId");
  const [factTitle, setFactTitle] = useState<string>("");

  useEffect(() => {
    if (!factId) return;
    setLoading(true);
    Promise.all([
      fetchQuestions({ factId, limit: 100 }),
      fetchFacts(),
    ]).then(([qs, facts]) => {
      setQuestions(qs);
      setFactTitle(facts.find((f) => f.id === factId)?.title ?? "");
      setLoading(false);
    });
  }, [factId]);
```
- factId 모드에서 헤더에 연표 제목 노출: `if (questions)` 블록의 "← 조건 다시 설정" 버튼을 factId 유무로 분기:
```typescript
  if (questions) {
    return (
      <div className="space-y-4">
        {factId ? (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted">연표 <b className="text-foreground">{factTitle}</b> 관련 문제 {questions.length}개</p>
            <a href="/timeline" className="text-sm text-muted hover:text-foreground">← 연표로</a>
          </div>
        ) : (
          <button className="text-sm text-muted hover:text-foreground" onClick={() => setQuestions(null)}>
            ← 조건 다시 설정
          </button>
        )}
        {questions.length === 0 ? (
          <div className="card p-8 text-center text-muted">이 연표에 연결된 문제가 아직 없습니다.</div>
        ) : (
          <StudyRunner questions={questions} />
        )}
      </div>
    );
  }
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: PASS(useSearchParams가 Suspense로 감싸져 prerender 경고 없음).

- [ ] **Step 3: 수동 확인**

`npm run dev` 후 브라우저/curl로 `/study?factId=<존재하는 factId>` 접근 → 연결 문제로 StudyRunner 시작 또는 "연결된 문제가 아직 없습니다" 표시.

- [ ] **Step 4: Commit**

```bash
git add src/app/study/page.tsx
git commit -m "feat: /study?factId= 연표 연결 문제 학습 라우트

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 11: 연표 페이지 — 분류 배지 + 관련 문제 풀기 버튼

**Files:**
- Modify: `src/app/timeline/page.tsx`

**Interfaces:**
- Consumes: `FactDTO`(period/category/importance/questionCount, Task 2/3), `fetchFacts`.
- Produces: 상세 패널에 분류 배지 + "관련 문제 N개 풀기"(`/study?factId=`) 버튼, period 소그룹 표시.

- [ ] **Step 1: 상세 패널에 배지·버튼 추가**

`src/app/timeline/page.tsx`의 상세 패널(`{active && (...)}`) 안, `body` 표시 아래·`relatedTo` 위에 추가:
```typescript
            <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
              {active.category && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-primary">{active.category}</span>}
              {active.importance ? <span className="rounded-full bg-accent/12 px-2 py-0.5 text-accent">{"★".repeat(active.importance)}</span> : null}
              {active.period && <span className="rounded-full bg-surface-2 px-2 py-0.5">{active.period}</span>}
            </div>
```
- "닫기" 버튼 위에 "관련 문제 풀기" 버튼 추가:
```typescript
            {(active.questionCount ?? 0) > 0 && (
              <a href={`/study?factId=${active.id}`} className="btn btn-primary mt-2 w-full py-2">
                관련 문제 {active.questionCount}개 풀기
              </a>
            )}
```

- [ ] **Step 2: 카드 목록에 period 소그룹(선택적 시각화)**

`grouped`의 각 era 열에서 `items`를 period로 묶어 소제목을 표시한다. era 열 렌더링의 `items.map(...)` 부분을 period 그룹 렌더링으로 교체:
```typescript
                <div className="relative space-y-3 border-l-2 pl-4" style={{ borderColor: era.color }}>
                  {groupByPeriod(items).map(({ period, rows }) => (
                    <div key={period ?? "_"} className="space-y-2">
                      {period && <div className="text-xs font-semibold text-muted">{period}</div>}
                      {rows.map((f) => (
                        <button key={f.id} onClick={() => setActive(f)} className="card relative w-full p-3 text-left hover:border-primary/40">
                          <span className="absolute -left-[1.4rem] top-4 h-3 w-3 rounded-full ring-2 ring-[var(--background)]" style={{ background: era.color }} />
                          <span className="block text-xs text-muted">{yearLabel(f.year)}</span>
                          <span className="block font-semibold">{f.title}</span>
                          {(f.questionCount ?? 0) > 0 && <span className="mt-0.5 inline-block rounded bg-primary/12 px-1.5 text-[10px] text-primary">문제 {f.questionCount}</span>}
                          <span className="line-clamp-2 text-xs text-muted">{f.body}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
```
- 파일 하단(`yearLabel` 옆)에 헬퍼 추가:
```typescript
function groupByPeriod(items: FactDTO[]): { period: string | null; rows: FactDTO[] }[] {
  const order: string[] = [];
  const map = new Map<string, FactDTO[]>();
  for (const f of items) {
    const key = f.period ?? "_none";
    if (!map.has(key)) { map.set(key, []); order.push(key); }
    map.get(key)!.push(f);
  }
  return order.map((k) => ({ period: k === "_none" ? null : k, rows: map.get(k)! }));
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: 수동 확인**

`npm run dev` 후 `/timeline`에서 항목 클릭 → 배지·"관련 문제 N개 풀기" 버튼 표시, 클릭 시 `/study?factId=`로 이동.

- [ ] **Step 5: Commit**

```bash
git add src/app/timeline/page.tsx
git commit -m "feat: 연표 상세 분류 배지·관련 문제 풀기 버튼·period 소그룹

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 12: 관리자 ManualForm — 연표 멀티선택 피커

**Files:**
- Modify: `src/components/admin/ManualForm.tsx`

**Interfaces:**
- Consumes: `fetchFacts`(`src/lib/api.ts`), `POST /api/questions`(factIds 저장은 Task 3에서 지원).
- Produces: 문제 생성 시 같은 era 연표를 골라 `factIds`로 전송.

- [ ] **Step 1: era별 연표 로드 + 선택 상태**

`src/components/admin/ManualForm.tsx`:
- import 추가:
```typescript
import { useEffect } from "react";
import { fetchFacts } from "@/lib/api";
import type { FactDTO } from "@/lib/types";
```
- 상태 추가(다른 useState 옆):
```typescript
  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [factIds, setFactIds] = useState<string[]>([]);
```
- era 변경 시 해당 시대 연표 로드:
```typescript
  useEffect(() => {
    fetchFacts(era).then(setFacts);
    setFactIds([]);
  }, [era]);
```

- [ ] **Step 2: 피커 UI + 전송에 factIds 포함**

- `topics` 입력 아래에 피커 추가:
```tsx
      {facts.length > 0 && (
        <div className="rounded border bg-surface-2 p-2">
          <p className="mb-1 text-xs text-muted">관련 연표 연결 (선택) — 저장 후 AI가 자동 보완</p>
          <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
            {facts.map((f) => {
              const on = factIds.includes(f.id);
              return (
                <button key={f.id} type="button"
                  onClick={() => setFactIds((ids) => on ? ids.filter((x) => x !== f.id) : [...ids, f.id])}
                  className={`rounded-full px-2 py-0.5 text-xs ${on ? "bg-primary text-white" : "bg-surface border"}`}>
                  {f.year ?? ""} {f.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
```
- `save()`의 `body: JSON.stringify({ ... })`에 `factIds,` 추가.
- 저장 성공 시 초기화에 `setFactIds([]);` 추가.

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/ManualForm.tsx
git commit -m "feat: 관리자 수동 문제 생성에 연표 멀티선택 피커

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 13: 관리자 "연표 연결" 탭 (일괄 백필 UI)

**Files:**
- Create: `src/components/admin/FactLinkPanel.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/link-facts`(Task 6), `useUI`(toast).
- Produces: 관리자 콘솔에 "연표 연결" 탭 — 미연결/전체 일괄 실행 + 결과 표시.

- [ ] **Step 1: 패널 컴포넌트**

`src/components/admin/FactLinkPanel.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useUI } from "@/components/ui/UIProvider";
import { Loader2, Link2 } from "lucide-react";

export default function FactLinkPanel() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ processed: number; linked: number } | null>(null);

  async function run(mode: "missing" | "all") {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/link-facts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "실패");
      setResult(d);
      toast(`${d.processed}문제 처리, ${d.linked}개 연결됨`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "연결 실패", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm text-muted">
        Claude로 문제를 분석해 관련 연표(factIds)를 자동 연결합니다. 시간이 걸릴 수 있습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary px-4 py-2" onClick={() => run("missing")} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Link2 size={16} />} 미연결 문제 자동연결
        </button>
        <button className="btn btn-outline px-4 py-2" onClick={() => run("all")} disabled={busy}>
          전체 재연결
        </button>
      </div>
      {result && (
        <p className="text-sm">처리 {result.processed}문제 · 연결 {result.linked}개</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: admin 페이지에 탭 추가**

`src/app/admin/page.tsx`:
- import 추가:
```typescript
import FactLinkPanel from "@/components/admin/FactLinkPanel";
import { Link2 } from "lucide-react";
```
- `type Tab` 에 `"factlink"` 추가:
```typescript
type Tab = "upload" | "manual" | "release" | "manage" | "video" | "factlink";
```
- 탭 버튼 배열에 추가(`{ k: "video", ... }` 뒤):
```typescript
          { k: "factlink", label: "연표 연결", icon: Link2 },
```
- 탭 렌더링에 추가(`{tab === "video" && <VideoForm />}` 뒤):
```typescript
      {tab === "factlink" && <FactLinkPanel />}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/FactLinkPanel.tsx src/app/admin/page.tsx
git commit -m "feat: 관리자 연표 연결 탭(일괄 백필 UI)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 14: 통합 검증 + 기존 74문제 백필 실행

**Files:** (없음 — 실행·검증 전용)

**Interfaces:**
- Consumes: 전체 기능.

- [ ] **Step 1: 전체 테스트·빌드**

Run: `npm test && npm run build`
Expected: 모든 vitest PASS, 빌드 PASS.

- [ ] **Step 2: 로컬 서버 기동**

Run: `npm run dev` (별도 셸/백그라운드). `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/facts` → 200.

- [ ] **Step 3: 연표 데이터 적재 확인**

Run: `curl -s http://localhost:3000/api/facts | python -c "import sys,json; d=json.load(sys.stdin)['facts']; print('facts:', len(d)); print('with category:', sum(1 for f in d if f.get('category')))"`
Expected: 집필분(150~200대) + category 채워진 항목 다수.

- [ ] **Step 4: 관리자 로그인 후 일괄 백필**

```bash
ADMIN_PW=$(grep "^ADMIN_PASSWORD=" .env.local | cut -d'=' -f2-)
curl -s -X POST http://localhost:3000/api/admin/login -H "Content-Type: application/json" -d "{\"password\":\"$ADMIN_PW\"}" -c /tmp/c.txt
curl -s -X POST http://localhost:3000/api/admin/link-facts -H "Content-Type: application/json" -b /tmp/c.txt -d '{"mode":"missing"}'
```
Expected: `{"processed":74,"linked":N}` (N>0). ANTHROPIC_API_KEY·크레딧 필요.

- [ ] **Step 5: 연결 결과·학습 흐름 확인**

```bash
# 문제 수가 있는 fact 하나 찾기
curl -s http://localhost:3000/api/facts | python -c "import sys,json; d=json.load(sys.stdin)['facts']; c=[f for f in d if f.get('questionCount',0)>0]; print('연결된 연표:', len(c)); print(c[0]['id'], c[0]['title'], c[0]['questionCount']) if c else print('연결 없음')"
# 해당 factId로 문제 조회
curl -s "http://localhost:3000/api/questions?factId=<위 id>" | python -c "import sys,json; print('linked questions:', len(json.load(sys.stdin)['questions']))"
```
Expected: questionCount>0인 연표 존재, factId 조회로 문제 반환.

- [ ] **Step 6: 회귀 — 기존 페이지 정상**

`curl` 또는 브라우저로 `/bank`, `/timeline`, `/study`, `/admin` 200 및 정상 렌더 확인.

- [ ] **Step 7: 최종 커밋(없으면 생략) + 푸시**

변경이 없으면 생략. 푸시는 사용자 승인 후 진행(토큰 필요). 배포는 Cloud Shell에서 `git pull && gcloud run deploy ...`로 별도 수행.

---

## Self-Review 결과

- **Spec coverage**: §3 데이터모델→Task 2/3, §4 AI연결→Task 4/5/6/7, §5 API→Task 6/8, §6 UI→Task 10/11/12/13, §7 집필→Task 9. 모든 절 매핑됨.
- **Placeholder scan**: 모든 코드 스텝에 실제 코드 포함. Task 9 데이터 집필은 본질적으로 콘텐츠 작성이라 지침+예시 1건 제공(시대 단위 진행 명시).
- **Type consistency**: `factIds`(string[]), `candidateFacts`/`sanitizeFactIds`/`linkQuestionToFacts`/`linkAllQuestions`/`linkOneById`/`setQuestionFactIds`/`getQuestionsForLinking` 시그니처가 정의 태스크와 소비 태스크에서 일치. `FactDTO`의 `questionCount?`는 getFacts에서만 채움(옵셔널)으로 일관.
