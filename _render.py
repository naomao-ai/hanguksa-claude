import fitz, os
dl = os.path.expanduser("~/Downloads")
qz = os.path.join(dl, "78회 한국사_문제지(심화).pdf")
out = os.path.abspath("_pdf78")
os.makedirs(out, exist_ok=True)
d = fitz.open(qz)
mat = fitz.Matrix(170 / 72, 170 / 72)
for i in range(d.page_count):
    pix = d[i].get_pixmap(matrix=mat)
    p = os.path.join(out, f"p{i+1:02d}.png")
    pix.save(p)
    print(p, pix.width, "x", pix.height, round(os.path.getsize(p) / 1024), "KB")
