/**
 * YouTube URL/ID 유틸 (클라이언트·서버 공용).
 * 외부 API 키 없이 썸네일·임베드·시청 URL을 만든다.
 */

/** 다양한 형태의 YouTube URL에서 11자 영상 ID를 추출. 실패 시 null */
export function extractYoutubeId(url: string): string | null {
  if (!url) return null;
  const s = url.trim();
  // 이미 ID만 들어온 경우
  if (/^[\w-]{11}$/.test(s)) return s;
  const patterns = [
    /[?&]v=([\w-]{11})/, // watch?v=ID
    /youtu\.be\/([\w-]{11})/, // youtu.be/ID
    /\/embed\/([\w-]{11})/, // /embed/ID
    /\/shorts\/([\w-]{11})/, // /shorts/ID
    /\/live\/([\w-]{11})/, // /live/ID
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) return m[1];
  }
  return null;
}

/** 고화질 썸네일 (CORS 불필요, <img> 직접 사용 가능) */
export function thumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** 임베드 URL. autoplay 시 자동재생 + 모달 최소화 파라미터 */
export function embedUrl(id: string, autoplay = false): string {
  const p = new URLSearchParams({ rel: "0", modestbranding: "1" });
  if (autoplay) p.set("autoplay", "1");
  return `https://www.youtube.com/embed/${id}?${p.toString()}`;
}

/** 유튜브 시청 페이지 URL */
export function watchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}
