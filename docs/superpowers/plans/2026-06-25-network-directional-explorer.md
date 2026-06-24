# 관계망 방향성 탐색기 (/network 고도화) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 연표 항목에 AI로 생성한 이전(배경·원인)/이후(결과·영향) 방향 관계를 부여하고, `/network`를 시대 선택→중심 사건→좌(이전)/우(이후) 방향 레이아웃으로 최대 100단계까지 파고드는 탐색기로 개편한다.

**Architecture:** Firestore `facts`에 `prevFactIds`/`nextFactIds`를 추가하고, 서버 전용 AI 링커가 같은 시대(±인접) 후보로 Claude를 호출해 방향 관계를 산출한다. `/network`는 전체 facts를 클라이언트가 보유하고 id→fact 로 해석해 방향 뷰·breadcrumb를 구성한다. 순수 헬퍼는 단위테스트, Claude/Firestore/React는 빌드+수동 검증.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Firebase Admin (Firestore), `@anthropic-ai/sdk`(tool_use), Vitest, TailwindCSS 4.

## Global Constraints

- Next.js 16.2.9. 새 Next API 사용 전 `node_modules/next/dist/docs/` 확인. `useSearchParams`는 **Suspense로 감싼다**(기존 `src/app/study/page.tsx` 패턴).
- 테스트: Vitest. `src/**/*.test.ts`, 환경 `node`, `@`=`src` 별칭. **Firestore·네트워크·React에 접근하지 않는 순수 함수만 단위 테스트**.
- AI 모델: `process.env.CLAUDE_MODEL || "claude-opus-4-8"`. `src/lib/ai/link-facts.ts`의 `client()`·tool_use 패턴 재사용.
- 기존 Firestore 문서 비파괴: 새 필드는 옵셔널, 누락 시 `[]`.
- 쓰기/일괄 API는 `isAdmin(req)`(`src/lib/admin.ts`) 필수.
- 시대 키 순서: `prehistoric, gojoseon, samguk, nambukguk, goryeo, joseon, modern, japanese, contemporary` (`ERAS` in `src/lib/domain.ts`). `adjacentEras(eraKey)` 는 직전·자신·직후 시대 키 반환.
- 커밋 메시지 말미: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`.
- 빌드 확인 `npm run build`, 테스트 `npx vitest run`, 개발 `npm run dev`(포트 3000).
- 작업 브랜치: `docs/network-explorer-spec` (현재 브랜치). 이 브랜치에 커밋.

---

## File Structure

생성:
- `src/lib/ai/link-relations.ts` — `candidateFactsForFact`/`sanitizeRelations`(순수) + `linkFactRelations`(Claude) + `linkAllRelations`(일괄).
- `src/lib/ai/link-relations.test.ts` — 순수 헬퍼 테스트.
- `src/lib/network.ts` — `buildFactMap`/`resolveRelations`/`pushPath`(순수 UI 헬퍼).
- `src/lib/network.test.ts` — 테스트.
- `src/app/api/admin/link-relations/route.ts` — 일괄 API.
- `src/components/admin/RelationLinkPanel.tsx` — 관리자 "관계망 생성" 패널.

수정:
- `src/lib/types.ts` — `FactDTO` += `prevFactIds`/`nextFactIds`.
- `src/lib/firestore.ts` — `docToFact` 직렬화 + `setFactRelations`.
- `src/app/network/page.tsx` — 전면 개편(방향 탐색기).
- `src/app/timeline/page.tsx` — 상세에 "관계 탐색" 진입 버튼.
- `src/app/admin/page.tsx` — "관계망" 탭 추가.

---

## Task 1: 타입·Firestore — 방향 필드

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/firestore.ts`

**Interfaces:**
- Produces:
  - `FactDTO` += `prevFactIds: string[]`, `nextFactIds: string[]`.
  - `docToFact` → 두 필드 직렬화(누락 시 `[]`).
  - `setFactRelations(id: string, prevFactIds: string[], nextFactIds: string[]): Promise<void>`

- [ ] **Step 1: FactDTO에 필드 추가**

`src/lib/types.ts`의 `FactDTO`에서 `questionCount?` 줄 바로 위에 추가:
```typescript
  /** 이전(배경·원인) 연표 문서 id */
  prevFactIds: string[];
  /** 이후(결과·영향) 연표 문서 id */
  nextFactIds: string[];
```

- [ ] **Step 2: docToFact 직렬화**

`src/lib/firestore.ts`의 `docToFact` 반환 객체에서 `keywords:` 줄 바로 아래에 추가:
```typescript
    prevFactIds: Array.isArray(d.prevFactIds) ? d.prevFactIds : [],
    nextFactIds: Array.isArray(d.nextFactIds) ? d.nextFactIds : [],
```

- [ ] **Step 3: setFactRelations 추가**

`src/lib/firestore.ts`의 `searchFacts` 함수 바로 아래(Fact 영역 끝)에 추가:
```typescript
/** 연표 항목의 이전/이후 방향 관계 갱신 (AI 관계망 생성용) */
export async function setFactRelations(
  id: string,
  prevFactIds: string[],
  nextFactIds: string[]
): Promise<void> {
  await db.collection(COL.facts).doc(id).update({ prevFactIds, nextFactIds });
}
```

- [ ] **Step 4: 타입체크**

Run: `npx tsc --noEmit`
Expected: PASS (timeline/network 등 소비처는 옵셔널 아님이지만 docToFact가 항상 채우므로 FactDTO 생성처가 docToFact뿐이면 통과. seed-timeline.ts는 exclude됨).

만약 `FactDTO`를 직접 만드는 다른 곳에서 에러가 나면 그 객체에 `prevFactIds: [], nextFactIds: []` 추가. (현재 docToFact 외 생성처 없음 — 통과 예상.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/firestore.ts
git commit -m "feat: 연표 방향 관계 필드(prevFactIds/nextFactIds)·setFactRelations

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: AI 관계 링커 순수 헬퍼 (TDD)

**Files:**
- Create: `src/lib/ai/link-relations.ts`
- Create: `src/lib/ai/link-relations.test.ts`

**Interfaces:**
- Consumes: `adjacentEras`(domain), `FactDTO`(Task 1).
- Produces:
  - `candidateFactsForFact(fact: FactDTO, allFacts: FactDTO[]): FactDTO[]` — fact era의 인접 시대 facts(자기 자신 제외, year 오름차순, 최대 60).
  - `sanitizeRelations(returned: unknown, candidateIds: string[], selfId: string, max?: number): { prevFactIds: string[]; nextFactIds: string[] }` — 후보 화이트리스트·self 제외·prev/next 중복금지·각 최대 max(기본 5).

- [ ] **Step 1: Write the failing test**

`src/lib/ai/link-relations.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { candidateFactsForFact, sanitizeRelations } from "./link-relations";
import type { FactDTO } from "@/lib/types";

function fact(id: string, era: string, year: number): FactDTO {
  return { id, era, year, title: id, kind: "event", body: "", relatedTo: [], period: null, category: null, importance: null, keywords: [], prevFactIds: [], nextFactIds: [] };
}

describe("candidateFactsForFact", () => {
  it("인접 시대 + 자기 자신 제외", () => {
    const facts = [fact("self", "goryeo", 1000), fact("a", "samguk", 500), fact("b", "joseon", 1500), fact("c", "modern", 1880)];
    const res = candidateFactsForFact(fact("self", "goryeo", 1000), facts);
    expect(res.map((f) => f.id).sort()).toEqual(["a", "b"]); // nambukguk/goryeo/joseon 중 self·modern 제외
  });
  it("year 오름차순", () => {
    const facts = [fact("late", "goryeo", 1300), fact("early", "goryeo", 950), fact("x", "goryeo", 1000)];
    expect(candidateFactsForFact(fact("x", "goryeo", 1000), facts).map((f) => f.id)).toEqual(["early", "late"]);
  });
});

describe("sanitizeRelations", () => {
  it("후보 화이트리스트·self 제외", () => {
    const r = sanitizeRelations({ prevFactIds: ["a", "self", "x"], nextFactIds: ["b"] }, ["a", "b"], "self");
    expect(r).toEqual({ prevFactIds: ["a"], nextFactIds: ["b"] });
  });
  it("prev/next 중복 시 prev 우선·next에서 제거", () => {
    const r = sanitizeRelations({ prevFactIds: ["a"], nextFactIds: ["a", "b"] }, ["a", "b"], "self");
    expect(r).toEqual({ prevFactIds: ["a"], nextFactIds: ["b"] });
  });
  it("각 최대 개수 제한·중복 제거", () => {
    const r = sanitizeRelations({ prevFactIds: ["a", "a", "b", "c"], nextFactIds: [] }, ["a", "b", "c"], "self", 2);
    expect(r).toEqual({ prevFactIds: ["a", "b"], nextFactIds: [] });
  });
  it("배열 아니면 빈 결과", () => {
    expect(sanitizeRelations("nope", ["a"], "self")).toEqual({ prevFactIds: [], nextFactIds: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/link-relations.test.ts`
Expected: FAIL — 모듈/함수 없음.

- [ ] **Step 3: Implement the pure helpers**

`src/lib/ai/link-relations.ts`:
```typescript
import { adjacentEras } from "@/lib/domain";
import type { FactDTO } from "@/lib/types";

const MAX_CANDIDATES = 60;
const MAX_LINKS = 5;

/** fact era의 인접 시대 facts (자기 자신 제외, year 오름차순, 상한). */
export function candidateFactsForFact(fact: FactDTO, allFacts: FactDTO[]): FactDTO[] {
  const eras = new Set(adjacentEras(fact.era));
  return allFacts
    .filter((f) => eras.has(f.era) && f.id !== fact.id)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0))
    .slice(0, MAX_CANDIDATES);
}

function cleanList(returned: unknown, allow: Set<string>, selfId: string, max: number): string[] {
  if (!Array.isArray(returned)) return [];
  const out: string[] = [];
  for (const v of returned) {
    if (typeof v === "string" && v !== selfId && allow.has(v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

/** AI 반환값을 정제: 후보 화이트리스트·self 제외·prev/next 중복금지·각 최대 max. */
export function sanitizeRelations(
  returned: unknown,
  candidateIds: string[],
  selfId: string,
  max: number = MAX_LINKS
): { prevFactIds: string[]; nextFactIds: string[] } {
  const allow = new Set(candidateIds);
  const r = (returned ?? {}) as { prevFactIds?: unknown; nextFactIds?: unknown };
  const prev = cleanList(r.prevFactIds, allow, selfId, max);
  const prevSet = new Set(prev);
  const next = cleanList(r.nextFactIds, allow, selfId, max).filter((id) => !prevSet.has(id));
  return { prevFactIds: prev, nextFactIds: next };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/link-relations.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/link-relations.ts src/lib/ai/link-relations.test.ts
git commit -m "feat: 관계 링커 순수 헬퍼(candidateFactsForFact·sanitizeRelations) + 테스트

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: AI 관계 링커 Claude 호출 + 일괄

**Files:**
- Modify: `src/lib/ai/link-relations.ts`

**Interfaces:**
- Consumes: `candidateFactsForFact`/`sanitizeRelations`(Task 2), `getFacts`/`setFactRelations`(Task 1), `@anthropic-ai/sdk`.
- Produces:
  - `linkFactRelations(fact: FactDTO, allFacts: FactDTO[]): Promise<{ prevFactIds: string[]; nextFactIds: string[] }>`
  - `linkAllRelations(mode: "missing" | "all"): Promise<{ processed: number; linked: number }>`

- [ ] **Step 1: import·클라이언트 추가**

`src/lib/ai/link-relations.ts` 상단 import 영역에 추가:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import { getFacts, setFactRelations } from "@/lib/firestore";

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

- [ ] **Step 2: linkFactRelations 구현**

`src/lib/ai/link-relations.ts` 끝에 추가:
```typescript
const REL_TOOL = {
  name: "select_relations",
  description: "한 사건의 이전(배경·원인)·이후(결과·영향) 연표 항목 id를 선택한다.",
  input_schema: {
    type: "object" as const,
    properties: {
      prevFactIds: { type: "array", items: { type: "string" }, description: "이 사건의 직접적 배경·원인이 된 연표 id. 없으면 빈 배열. 최대 5개." },
      nextFactIds: { type: "array", items: { type: "string" }, description: "이 사건의 직접적 결과·영향이 된 연표 id. 없으면 빈 배열. 최대 5개." },
    },
    required: ["prevFactIds", "nextFactIds"],
  },
};

const REL_SYSTEM = `당신은 한국사 사건의 인과·흐름 관계를 연결하는 전문가입니다.
주어진 '대상 사건'에 대해 후보 연표 중에서:
- prevFactIds: 대상 사건의 직접적 배경·원인이 된 사건만 고릅니다(대개 더 이른 시기).
- nextFactIds: 대상 사건의 직접적 결과·영향이 된 사건만 고릅니다(대개 더 늦은 시기).
- 연도는 강한 힌트이되, 역사적 인과가 우선입니다.
- 단지 같은 시대라는 이유로 무관한 항목을 넣지 않습니다(억지 연결 금지). 없으면 빈 배열.
- 반드시 select_relations 도구를 호출합니다.`;

/** 단일 사건의 이전/이후 관계를 Claude로 산출. 실패·후보없음 시 빈 결과. */
export async function linkFactRelations(
  fact: FactDTO,
  allFacts: FactDTO[]
): Promise<{ prevFactIds: string[]; nextFactIds: string[] }> {
  const cands = candidateFactsForFact(fact, allFacts);
  if (cands.length === 0) return { prevFactIds: [], nextFactIds: [] };
  const candidateList = cands
    .map((f) => `- id:${f.id} | ${f.year ?? "?"} | ${f.title} | ${f.keywords.join(",")}`)
    .join("\n");
  const userText =
    `[대상 사건]\nid:${fact.id} | ${fact.year ?? "?"} | ${fact.title}\n내용: ${fact.body}\n핵심어: ${fact.keywords.join(", ")}\n시대: ${fact.era}\n` +
    `\n[연표 후보]\n${candidateList}\n\n대상 사건의 이전(배경·원인)·이후(결과·영향) 연표 id를 select_relations로 반환하세요.`;
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 400,
      system: REL_SYSTEM,
      tools: [REL_TOOL],
      tool_choice: { type: "tool", name: "select_relations" },
      messages: [{ role: "user", content: userText }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    const input = block && block.type === "tool_use" ? block.input : {};
    return sanitizeRelations(input, cands.map((f) => f.id), fact.id);
  } catch {
    return { prevFactIds: [], nextFactIds: [] };
  }
}

/** 일괄: missing=prev·next 모두 빈 항목만, all=전체. 순차. */
export async function linkAllRelations(
  mode: "missing" | "all"
): Promise<{ processed: number; linked: number }> {
  const allFacts = await getFacts();
  const targets = allFacts.filter(
    (f) => mode === "all" || (f.prevFactIds.length === 0 && f.nextFactIds.length === 0)
  );
  let linked = 0;
  for (const f of targets) {
    const rel = await linkFactRelations(f, allFacts);
    await setFactRelations(f.id, rel.prevFactIds, rel.nextFactIds);
    if (rel.prevFactIds.length > 0 || rel.nextFactIds.length > 0) linked++;
  }
  return { processed: targets.length, linked };
}
```

- [ ] **Step 3: 타입체크 + 순수 헬퍼 회귀**

Run: `npx tsc --noEmit && npx vitest run src/lib/ai/link-relations.test.ts`
Expected: tsc PASS, 6 tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/link-relations.ts
git commit -m "feat: Claude 기반 연표 방향 관계 생성(linkFactRelations·linkAllRelations)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: 관리자 일괄 API + 패널 + 탭

**Files:**
- Create: `src/app/api/admin/link-relations/route.ts`
- Create: `src/components/admin/RelationLinkPanel.tsx`
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `isAdmin`, `linkAllRelations`(Task 3).
- Produces: `POST /api/admin/link-relations` `{ mode?: "missing" | "all" }` → `{ processed, linked }`; 관리자 "관계망" 탭.

- [ ] **Step 1: 일괄 API**

`src/app/api/admin/link-relations/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { linkAllRelations } from "@/lib/ai/link-relations";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// POST /api/admin/link-relations { mode?: "missing" | "all" }
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "관리자 인증이 필요합니다." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const mode = body.mode === "all" ? "all" : "missing";
  try {
    const result = await linkAllRelations(mode);
    return NextResponse.json(result);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const status = /ANTHROPIC_API_KEY/.test(raw) ? 503 : 500;
    return NextResponse.json({ error: "관계망 생성 중 오류: " + raw }, { status });
  }
}
```

- [ ] **Step 2: RelationLinkPanel**

`src/components/admin/RelationLinkPanel.tsx`:
```tsx
"use client";

import { useState } from "react";
import { useUI } from "@/components/ui/UIProvider";
import { Loader2, Share2 } from "lucide-react";

/** 관리자 전용: Claude로 연표 이전/이후 관계망 일괄 생성 */
export default function RelationLinkPanel() {
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ processed: number; linked: number } | null>(null);

  async function run(mode: "missing" | "all") {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/link-relations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "실패");
      setResult(d);
      toast(`${d.processed}항목 처리, ${d.linked}개 관계 생성`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "생성 실패", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-5">
      <p className="text-sm text-muted">
        Claude로 각 연표 항목의 이전(배경·원인)·이후(결과·영향) 관계를 생성합니다. 시간이 걸릴 수 있습니다.
      </p>
      <div className="flex flex-wrap gap-2">
        <button className="btn btn-primary px-4 py-2" onClick={() => run("missing")} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" size={16} /> : <Share2 size={16} />} 미생성 항목 관계 생성
        </button>
        <button className="btn btn-outline px-4 py-2" onClick={() => run("all")} disabled={busy}>
          전체 재생성
        </button>
      </div>
      {result && <p className="text-sm">처리 {result.processed}항목 · 관계 {result.linked}개</p>}
    </div>
  );
}
```

- [ ] **Step 3: admin 페이지 탭 추가**

`src/app/admin/page.tsx`:
- import 추가:
```typescript
import RelationLinkPanel from "@/components/admin/RelationLinkPanel";
import { Share2 } from "lucide-react";
```
- `type Tab` 에 `"relation"` 추가:
```typescript
type Tab = "upload" | "manual" | "release" | "manage" | "video" | "factlink" | "relation";
```
- 탭 버튼 배열에서 `{ k: "factlink", ... }` 뒤에 추가:
```typescript
          { k: "relation", label: "관계망", icon: Share2 },
```
- 탭 렌더링에서 `{tab === "factlink" && <FactLinkPanel />}` 뒤에 추가:
```typescript
      {tab === "relation" && <RelationLinkPanel />}
```

- [ ] **Step 4: 빌드 확인**

Run: `npm run build`
Expected: 라우트 목록에 `ƒ /api/admin/link-relations`, 빌드 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/link-relations/route.ts src/components/admin/RelationLinkPanel.tsx src/app/admin/page.tsx
git commit -m "feat: 관리자 연표 관계망 일괄 생성 API·패널·탭

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: 네트워크 순수 UI 헬퍼 (TDD)

**Files:**
- Create: `src/lib/network.ts`
- Create: `src/lib/network.test.ts`

**Interfaces:**
- Consumes: `FactDTO`(Task 1).
- Produces:
  - `buildFactMap(facts: FactDTO[]): Map<string, FactDTO>`
  - `resolveRelations(fact: FactDTO, map: Map<string, FactDTO>): { prev: FactDTO[]; next: FactDTO[] }` — id→fact, 없는 id 제외.
  - `pushPath(path: string[], id: string, max?: number): string[]` — id가 path에 있으면 그 지점까지 잘라 되돌아감, 없으면 추가, 길이 max(기본 100) 초과 시 앞에서 제거.

- [ ] **Step 1: Write the failing test**

`src/lib/network.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildFactMap, resolveRelations, pushPath } from "./network";
import type { FactDTO } from "@/lib/types";

function fact(id: string, prev: string[] = [], next: string[] = []): FactDTO {
  return { id, era: "goryeo", year: 1000, title: id, kind: "event", body: "", relatedTo: [], period: null, category: null, importance: null, keywords: [], prevFactIds: prev, nextFactIds: next };
}

describe("buildFactMap", () => {
  it("id로 조회 가능한 맵", () => {
    const m = buildFactMap([fact("a"), fact("b")]);
    expect(m.get("a")?.id).toBe("a");
    expect(m.size).toBe(2);
  });
});

describe("resolveRelations", () => {
  it("id를 fact로 해석, 없는 id 제외", () => {
    const map = buildFactMap([fact("c"), fact("self", ["c"], ["missing"])]);
    const r = resolveRelations(map.get("self")!, map);
    expect(r.prev.map((f) => f.id)).toEqual(["c"]);
    expect(r.next).toEqual([]);
  });
});

describe("pushPath", () => {
  it("새 id는 추가", () => {
    expect(pushPath(["a"], "b")).toEqual(["a", "b"]);
  });
  it("기존 id면 그 지점까지 되돌아감", () => {
    expect(pushPath(["a", "b", "c"], "a")).toEqual(["a"]);
  });
  it("최대 길이 초과 시 앞에서 제거", () => {
    expect(pushPath(["a", "b"], "c", 2)).toEqual(["b", "c"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/network.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: Implement**

`src/lib/network.ts`:
```typescript
import type { FactDTO } from "@/lib/types";

export function buildFactMap(facts: FactDTO[]): Map<string, FactDTO> {
  return new Map(facts.map((f) => [f.id, f]));
}

export function resolveRelations(
  fact: FactDTO,
  map: Map<string, FactDTO>
): { prev: FactDTO[]; next: FactDTO[] } {
  const pick = (ids: string[]) => ids.map((id) => map.get(id)).filter((f): f is FactDTO => !!f);
  return { prev: pick(fact.prevFactIds), next: pick(fact.nextFactIds) };
}

/** breadcrumb 경로 갱신. 기존 id면 되돌아가고, 새 id면 추가(최대 max). */
export function pushPath(path: string[], id: string, max: number = 100): string[] {
  const i = path.indexOf(id);
  if (i >= 0) return path.slice(0, i + 1);
  const next = [...path, id];
  return next.length > max ? next.slice(next.length - max) : next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/network.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/network.ts src/lib/network.test.ts
git commit -m "feat: 관계망 순수 UI 헬퍼(buildFactMap·resolveRelations·pushPath) + 테스트

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: /network 방향 탐색기 전면 개편

**Files:**
- Modify: `src/app/network/page.tsx` (전체 교체)

**Interfaces:**
- Consumes: `fetchFacts`(api), `ERAS`/`eraColor`/`eraLabel`(domain), `buildFactMap`/`resolveRelations`/`pushPath`(Task 5), `FactDTO`(Task 1).
- Produces: 시대 선택 → 중심 사건 → 좌(이전)/우(이후) 방향 뷰 + breadcrumb + 드릴다운. `?factId=` 진입 지원.

- [ ] **Step 1: 전체 교체**

`src/app/network/page.tsx` 를 아래로 **전부 교체**:
```tsx
"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { fetchFacts } from "@/lib/api";
import { ERAS, eraColor, eraLabel } from "@/lib/domain";
import { buildFactMap, resolveRelations, pushPath } from "@/lib/network";
import type { FactDTO } from "@/lib/types";
import { Loader2, Network as NetIcon, ArrowLeft, ArrowRight } from "lucide-react";

function yearLabel(y: number | null): string {
  if (y == null) return "";
  return y < 0 ? `BC ${-y}` : `${y}`;
}

function NetworkPage() {
  const params = useSearchParams();
  const initialFactId = params.get("factId");
  const [facts, setFacts] = useState<FactDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [era, setEra] = useState<string>("");
  const [path, setPath] = useState<string[]>([]);

  useEffect(() => {
    fetchFacts().then((f) => { setFacts(f); setLoading(false); });
  }, []);
  useEffect(() => {
    if (initialFactId) setPath([initialFactId]);
  }, [initialFactId]);

  const factMap = useMemo(() => buildFactMap(facts), [facts]);
  const centerId = path[path.length - 1] ?? null;
  const center = centerId ? factMap.get(centerId) ?? null : null;
  const rel = useMemo(
    () => (center ? resolveRelations(center, factMap) : { prev: [], next: [] }),
    [center, factMap]
  );

  function go(id: string) { setPath((p) => pushPath(p, id)); }

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>;

  return (
    <div className="space-y-4">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><NetIcon className="text-primary" /> 사건 관계망</h1>
        <p className="text-muted">한 사건의 이전(배경·원인)·이후(결과·영향)를 따라 흐름을 탐색합니다.</p>
      </header>

      {!center ? (
        // 진입: 시대 선택 → 사건 목록
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {ERAS.map((e) => (
              <button key={e.key} onClick={() => setEra(e.key)}
                className={`rounded-full px-3 py-1.5 text-sm ${era === e.key ? "text-white" : "border bg-surface"}`}
                style={era === e.key ? { background: e.color } : undefined}>
                {e.label}
              </button>
            ))}
          </div>
          {era ? (
            <ul className="space-y-2">
              {facts.filter((f) => f.era === era).sort((a, b) => (a.year ?? 0) - (b.year ?? 0)).map((f) => (
                <li key={f.id}>
                  <button onClick={() => setPath([f.id])} className="card flex w-full items-center gap-3 p-3 text-left hover:border-primary/40">
                    <span className="text-xs text-muted">{yearLabel(f.year)}</span>
                    <span className="font-semibold">{f.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="card p-8 text-center text-muted">시대를 선택하면 사건 목록이 나옵니다.</div>
          )}
        </div>
      ) : (
        // 탐색 뷰: breadcrumb + 이전 | 현재 | 이후
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-1 text-sm">
            <button onClick={() => setPath([])} className="text-muted hover:text-foreground">시대 선택</button>
            {path.map((id, i) => {
              const f = factMap.get(id);
              return (
                <span key={id} className="flex items-center gap-1">
                  <span className="text-muted">/</span>
                  <button onClick={() => setPath(path.slice(0, i + 1))}
                    className={i === path.length - 1 ? "font-semibold text-primary" : "text-muted hover:text-foreground"}>
                    {f?.title ?? id}
                  </button>
                </span>
              );
            })}
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_1.2fr_1fr]">
            <RelColumn title="이전 (배경·원인)" icon={<ArrowLeft size={14} />} items={rel.prev} onGo={go} align="end" />

            <div className="card border-primary/40 p-4">
              {center.category || center.importance || center.period ? (
                <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
                  {center.category && <span className="rounded-full bg-primary/12 px-2 py-0.5 text-primary">{center.category}</span>}
                  {center.importance ? <span className="rounded-full bg-accent/12 px-2 py-0.5 text-accent">{"★".repeat(center.importance)}</span> : null}
                  {center.period && <span className="rounded-full bg-surface-2 px-2 py-0.5">{center.period}</span>}
                </div>
              ) : null}
              <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: eraColor(center.era) }}>
                {eraLabel(center.era)} · {yearLabel(center.year)}
              </span>
              <h2 className="mt-2 text-xl font-bold">{center.title}</h2>
              <p className="mt-2 text-sm leading-relaxed">{center.body}</p>
              {(center.questionCount ?? 0) > 0 && (
                <a href={`/study?factId=${center.id}`} className="btn btn-primary mt-3 w-full py-2">관련 문제 {center.questionCount}개 풀기</a>
              )}
            </div>

            <RelColumn title="이후 (결과·영향)" icon={<ArrowRight size={14} />} items={rel.next} onGo={go} align="start" />
          </div>
        </div>
      )}
    </div>
  );
}

function RelColumn({ title, icon, items, onGo, align }: {
  title: string; icon: React.ReactNode; items: FactDTO[]; onGo: (id: string) => void; align: "start" | "end";
}) {
  return (
    <div className="space-y-2">
      <div className={`flex items-center gap-1 text-xs font-semibold text-muted ${align === "end" ? "md:justify-end" : ""}`}>
        {icon} {title}
      </div>
      {items.length === 0 ? (
        <div className="card p-3 text-center text-xs text-muted">관계 없음</div>
      ) : (
        items.map((f) => (
          <button key={f.id} onClick={() => onGo(f.id)} className="card w-full p-3 text-left hover:border-primary/40">
            <span className="block text-xs text-muted">{yearLabel(f.year)}</span>
            <span className="block text-sm font-semibold">{f.title}</span>
            <span className="line-clamp-2 text-xs text-muted">{f.body}</span>
          </button>
        ))
      )}
    </div>
  );
}

export default function NetworkPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center p-10"><Loader2 className="animate-spin text-muted" /></div>}>
      <NetworkPage />
    </Suspense>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: PASS(`useSearchParams`가 Suspense로 감싸져 prerender 경고 없음). `/network` 가 정적(○) 또는 동적으로 정상 빌드.

- [ ] **Step 3: Commit**

```bash
git add src/app/network/page.tsx
git commit -m "feat: /network 방향 탐색기 개편(시대선택·이전/이후·breadcrumb·드릴다운)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: /timeline 상세에 "관계 탐색" 진입 버튼

**Files:**
- Modify: `src/app/timeline/page.tsx`

**Interfaces:**
- Consumes: 상세 패널의 `active.id`.
- Produces: `/network?factId=<id>` 진입 버튼.

- [ ] **Step 1: 버튼 추가**

`src/app/timeline/page.tsx` 상세 패널에서 "관련 문제 N개 풀기" 앵커(`<a ... href={`/study?factId=${active.id}`} ...>`) 바로 아래에 추가:
```tsx
            <a href={`/network?factId=${active.id}`} className="btn btn-outline mt-2 w-full py-2">
              이전·이후 관계 탐색
            </a>
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/timeline/page.tsx
git commit -m "feat: 연표 상세에 관계 탐색(/network) 진입 버튼

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: 통합 검증 + 147개 관계망 일괄 생성

**Files:** (없음 — 실행·검증)

- [ ] **Step 1: 전체 테스트·빌드**

Run: `npx vitest run && npm run build`
Expected: 모든 테스트 PASS(기존 21 + 신규 12 = 33), 빌드 PASS.

- [ ] **Step 2: dev 서버 + 관리자 로그인 후 관계망 일괄 생성**

```bash
npm run dev   # 별도 셸, 포트 3000
```
```bash
ADMIN_PW=$(grep "^ADMIN_PASSWORD=" .env.local | cut -d'=' -f2-)
curl -s -X POST http://localhost:3000/api/admin/login -H "Content-Type: application/json" -d "{\"password\":\"$ADMIN_PW\"}" -c /tmp/c.txt -o /dev/null
curl -s -X POST http://localhost:3000/api/admin/link-relations -H "Content-Type: application/json" -b /tmp/c.txt -d '{"mode":"missing"}' --max-time 600
```
Expected: `{"processed":147,"linked":N}` (N>0). ANTHROPIC_API_KEY·크레딧 필요.

- [ ] **Step 3: 방향 관계 데이터 검증**

```bash
curl -s http://localhost:3000/api/facts | python -c "import sys,json; d=json.load(sys.stdin)['facts']; print('prev>0:', sum(1 for f in d if f.get('prevFactIds')), '| next>0:', sum(1 for f in d if f.get('nextFactIds')))"
```
Expected: prev>0, next>0 인 항목 다수.

- [ ] **Step 4: 탐색 흐름 수동 확인**

`/network` → 시대(예: 고려) 선택 → 사건 클릭 → 중심 카드 + 이전/이후 열 표시 → 이후 항목 클릭 → 중심 이동 + breadcrumb 갱신. `/timeline` 항목 → "이전·이후 관계 탐색" → `/network?factId=` 진입 확인.

- [ ] **Step 5: 회귀 — 기존 페이지 200**

`/bank`, `/study`, `/admin`, `/timeline` HTTP 200 확인.

---

## Self-Review 결과

- **Spec coverage**: §3 데이터모델→Task 1, §4 AI링커→Task 2/3, §5 API→Task 4, §6 UI→Task 6/7, 관리자→Task 4, 일괄생성→Task 8. 모든 절 매핑됨.
- **Placeholder scan**: 모든 코드 스텝에 실제 코드 포함. 빈 항목 없음.
- **Type consistency**: `prevFactIds`/`nextFactIds`(string[]), `candidateFactsForFact`/`sanitizeRelations`/`linkFactRelations`/`linkAllRelations`/`setFactRelations`/`buildFactMap`/`resolveRelations`/`pushPath` 시그니처가 정의 태스크와 소비 태스크에서 일치. `sanitizeRelations` 반환 `{prevFactIds, nextFactIds}` 가 linkFactRelations·linkAllRelations에서 일관 사용.
