import { randomUUID } from "crypto";
import { bucket } from "./firebase-admin.ts";

/** 일시 오류(5xx·연결 리셋·타임아웃)로 판단되면 지수 백오프로 재시도한다. */
function isTransient(e: unknown): boolean {
  const err = e as { code?: number | string; message?: string };
  const code = err?.code;
  if (typeof code === "number" && code >= 500) return true;
  const s = `${code ?? ""} ${err?.message ?? ""}`;
  return /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|\b(500|502|503|504)\b/i.test(s);
}

/** file.save는 전제조건이 없어 GCS 클라이언트가 자동 재시도하지 않으므로 일시 오류를 직접 재시도한다. */
async function saveWithRetry(
  file: ReturnType<ReturnType<typeof bucket>["file"]>,
  buf: Buffer,
  mime: string,
  token: string,
  attempts = 3
): Promise<void> {
  for (let i = 0; ; i++) {
    try {
      await file.save(buf, {
        resumable: false,
        contentType: mime,
        metadata: {
          cacheControl: "public, max-age=31536000",
          metadata: { firebaseStorageDownloadTokens: token },
        },
      });
      return;
    } catch (e) {
      if (i >= attempts - 1 || !isTransient(e)) throw e;
      await new Promise((r) => setTimeout(r, 300 * 2 ** i)); // 300ms·600ms·1200ms
    }
  }
}

/**
 * base64 data URL 이미지를 Firebase Storage에 업로드하고 공개 접근 가능한
 * 다운로드 URL을 반환한다. (균일 버킷 접근에서도 동작하도록 download token 사용)
 * 입력이 data URL이 아니면(이미 http URL 등) 그대로 반환한다.
 */
export async function uploadImageFromDataUrl(dataUrl: string, id: string): Promise<string> {
  const m = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/.exec(dataUrl || "");
  if (!m) return dataUrl; // 이미 URL이거나 빈 값
  const mime = m[1];
  const buf = Buffer.from(m[2], "base64");
  const ext = (mime.split("/")[1] || "png").replace(/[^\w]/g, "") || "png";
  const path = `question-images/${id}.${ext}`;
  const token = randomUUID();
  const file = bucket().file(path);
  await saveWithRetry(file, buf, mime, token);
  const b = bucket().name;
  return `https://firebasestorage.googleapis.com/v0/b/${b}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

/** 업로드된 이미지 URL이 우리 버킷의 것인지 확인 후 삭제(문항 삭제 시 정리용) */
export async function deleteImageByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const m = /\/o\/([^?]+)\?/.exec(url);
  if (!m) return;
  const path = decodeURIComponent(m[1]);
  try {
    await bucket().file(path).delete({ ignoreNotFound: true });
  } catch {
    // 정리는 베스트 에포트
  }
}
