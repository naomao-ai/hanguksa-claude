import fitz, os
from PIL import Image
dl = os.path.expanduser("~/Downloads")
qz = os.path.join(dl, "78회 한국사_문제지(심화).pdf")
out = os.path.abspath("_pdf78_q")
os.makedirs(out, exist_ok=True)
d = fitz.open(qz)
mat = fitz.Matrix(300 / 72, 300 / 72)
for i in range(d.page_count):
    pix = d[i].get_pixmap(matrix=mat)
    tmp = os.path.join(out, f"_p{i+1:02d}.png")
    pix.save(tmp)
    im = Image.open(tmp)
    w, h = im.size
    xm, ym = w // 2, h // 2
    ox, oy = int(w * 0.04), int(h * 0.04)
    boxes = {
        "TL": (0, 0, xm + ox, ym + oy),
        "BL": (0, ym - oy, xm + ox, h),
        "TR": (xm - ox, 0, w, ym + oy),
        "BR": (xm - ox, ym - oy, w, h),
    }
    for k, b in boxes.items():
        im.crop(b).save(os.path.join(out, f"p{i+1:02d}_{k}.png"))
    os.remove(tmp)
print("done", d.page_count, "pages x4 quadrants")
