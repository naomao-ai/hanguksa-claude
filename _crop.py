from PIL import Image
import os, glob

src = os.path.abspath("_pdf78")
out = os.path.abspath("_pdf78_cols")
os.makedirs(out, exist_ok=True)

for f in sorted(glob.glob(os.path.join(src, "p*.png"))):
    name = os.path.splitext(os.path.basename(f))[0]
    im = Image.open(f)
    w, h = im.size
    mid = w // 2
    pad = int(w * 0.03)
    left = im.crop((0, 0, mid + pad, h))
    right = im.crop((mid - pad, 0, w, h))
    left.save(os.path.join(out, f"{name}_L.png"))
    right.save(os.path.join(out, f"{name}_R.png"))
    print(name, "->", left.size, right.size)
