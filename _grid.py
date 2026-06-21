from PIL import Image, ImageDraw
import os
src = os.path.abspath("_pdf78/p01.png")
im = Image.open(src).convert("RGB")
w, h = im.size
d = ImageDraw.Draw(im)
for p in range(0, 101, 5):
    x = int(w * p / 100); y = int(h * p / 100)
    col = (255, 0, 0) if p % 10 == 0 else (255, 160, 160)
    d.line([(x, 0), (x, h)], fill=col, width=1)
    d.line([(0, y), (w, y)], fill=col, width=1)
    if p % 10 == 0:
        d.text((x + 2, 2), str(p), fill=(255, 0, 0))
        d.text((2, y + 2), str(p), fill=(0, 0, 255))
out = os.path.abspath("_pdf78_hi/p01_grid.png")
im.save(out)
print(out, im.size)
