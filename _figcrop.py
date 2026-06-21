from PIL import Image
import os
full = os.path.abspath("_pdf78_hi/p01_full.png")  # 300dpi page1 (3036x4300)
im = Image.open(full)
w, h = im.size
out = os.path.abspath("public/exam78")
os.makedirs(out, exist_ok=True)
# (x0,y0,x1,y1) 분수 좌표 — 격자 확인 기반
boxes = {
    "q01": (0.06, 0.247, 0.405, 0.392),
    "q02": (0.05, 0.655, 0.47, 0.86),
    "q04": (0.545, 0.645, 0.955, 0.822),
}
for name, (x0, y0, x1, y1) in boxes.items():
    crop = im.crop((int(w * x0), int(h * y0), int(w * x1), int(h * y1)))
    p = os.path.join(out, f"{name}.png")
    crop.save(p)
    print(p, crop.size, round(os.path.getsize(p) / 1024), "KB")
