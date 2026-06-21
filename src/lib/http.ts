import { NextResponse } from "next/server";

/**
 * 공개 읽기 응답에 캐시 헤더를 부여한다.
 * 데이터는 관리자 발행 시에만 변하므로, 다수 동시 열람 시 DB 부하를 크게 줄인다.
 * (CDN/프록시·브라우저 캐시에서 효과. stale-while-revalidate로 체감 지연 최소화)
 */
export function cachedJson(data: unknown, seconds = 30): NextResponse {
  const res = NextResponse.json(data);
  res.headers.set(
    "Cache-Control",
    `public, max-age=${seconds}, s-maxage=${seconds}, stale-while-revalidate=${seconds * 2}`
  );
  return res;
}
