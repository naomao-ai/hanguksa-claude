// 로컬 학습기록과 클라우드 기록을 '손실 없이' 병합하는 순수 함수.
// 기존 downloadCloudToLocalStore가 로컬을 클라우드로 덮어써 데이터가 유실되던 문제를
// 막기 위해, 두 기록의 합집합을 취한다. 순수 함수라 로그인 없이 유닛테스트로 검증 가능.
import type { Store, Attempt, ExamRecord, Streak, Attendance, Settings } from "./local-store";
import type { SrsState } from "./srs";

function uniqBy<T>(arr: T[], key: (x: T) => string): T[] {
  const m = new Map<string, T>();
  for (const x of arr) {
    const k = key(x);
    if (!m.has(k)) m.set(k, x);
  }
  return [...m.values()];
}

function union(a: string[] = [], b: string[] = []): string[] {
  return [...new Set([...a, ...b])];
}

// SRS는 due(다음 복습 시각)가 더 미래인 쪽 = 더 최근에 학습된 상태로 본다.
function mergeSrs(
  a: Record<string, SrsState> = {},
  b: Record<string, SrsState> = {}
): Record<string, SrsState> {
  const out: Record<string, SrsState> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    const cur = out[k];
    if (!cur || v.due > cur.due || (v.due === cur.due && v.repetition > cur.repetition)) {
      out[k] = v;
    }
  }
  return out;
}

function mergeStreak(a: Streak, b?: Streak): Streak {
  if (!b) return a;
  const studyDays = union(a.studyDays, b.studyDays).sort();
  const newer = (a.lastDay ?? "") >= (b.lastDay ?? "") ? a : b;
  return { current: newer.current, longest: Math.max(a.longest, b.longest), lastDay: newer.lastDay, studyDays };
}

function mergeAttendance(a: Attendance, b?: Attendance): Attendance {
  if (!b) return a;
  const newer = (a.lastDay ?? "") >= (b.lastDay ?? "") ? a : b;
  return {
    lastDay: newer.lastDay,
    current: newer.current,
    total: Math.max(a.total, b.total),
    longest: Math.max(a.longest, b.longest),
  };
}

/** 로컬과 클라우드(부분 가능) Store를 손실 없이 병합한다. */
export function mergeStores(local: Store, cloud: Partial<Store>): Store {
  return {
    attempts: uniqBy(
      [...(local.attempts ?? []), ...((cloud.attempts as Attempt[]) ?? [])],
      (a) => `${a.ts}:${a.questionId}`
    ).sort((x, y) => x.ts - y.ts),
    examHistory: uniqBy(
      [...(local.examHistory ?? []), ...((cloud.examHistory as ExamRecord[]) ?? [])],
      (e) => `${e.ts}`
    ).sort((x, y) => x.ts - y.ts),
    srs: mergeSrs(local.srs, cloud.srs),
    flashcards: mergeSrs(local.flashcards, cloud.flashcards),
    bookmarks: union(local.bookmarks, cloud.bookmarks),
    badges: union(local.badges, cloud.badges),
    streak: mergeStreak(local.streak, cloud.streak),
    attendance: mergeAttendance(local.attendance, cloud.attendance),
    // 설정은 클라우드 값이 있으면 우선(마지막 저장 의도), 없으면 로컬 유지.
    settings: { ...local.settings, ...((cloud.settings as Settings) ?? {}) },
  };
}
