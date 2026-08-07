// PWA 앱 아이콘 생성 — 브랜드 teal(#0f6e64) 배경 + 흰색 "한".
// 맑은고딕으로 한글을 렌더해 192/512 PNG를 public/에 출력.
// 실행: node scripts/gen-pwa-icons.mjs
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { writeFileSync } from "fs";

GlobalFonts.registerFromPath("C:\\Windows\\Fonts\\malgunbd.ttf", "MalgunBold");

const TEAL = "#0f6e64";

function draw(size) {
  const c = createCanvas(size, size);
  const x = c.getContext("2d");
  // 배경 꽉 채움(maskable safe) — OS가 모서리를 둥글게 마스킹
  x.fillStyle = TEAL;
  x.fillRect(0, 0, size, size);
  // 은은한 하단 광택
  const g = x.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "rgba(255,255,255,0.08)");
  g.addColorStop(1, "rgba(0,0,0,0.10)");
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  // "한"
  x.fillStyle = "#ffffff";
  x.font = `${Math.round(size * 0.56)}px "MalgunBold"`;
  x.textAlign = "center";
  x.textBaseline = "middle";
  x.fillText("한", size / 2, size * 0.54);
  return c.toBuffer("image/png");
}

for (const s of [192, 512]) {
  const buf = draw(s);
  writeFileSync(`public/icon-${s}.png`, buf);
  console.log(`✅ public/icon-${s}.png (${buf.length} bytes)`);
}
