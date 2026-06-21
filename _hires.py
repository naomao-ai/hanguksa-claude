import fitz, os
from PIL import Image
dl = os.path.expanduser("~/Downloads")
qz = os.path.join(dl, "78회 한국사_문제지(심화).pdf")
out = os.path.abspath("_pdf78_hi")
os.makedirs(out, exist_ok=True)
d = fitz.open(qz)
mat = fitz.Matrix(300 / 72, 300 / 72)
pix = d[0].get_pixmap(matrix=mat)
full = os.path.join(out, "p01_full.png")
pix.save(full)
im = Image.open(full)
w, h = im.size
# 좌상단(1번 문항) 영역 크롭
q1 = im.crop((0, int(h * 0.06), int(w * 0.52), int(h * 0.52)))
q1.save(os.path.join(out, "p01_q1.png"))
print("full", im.size, "q1", q1.size)
