import fitz, os
dl = os.path.expanduser("~/Downloads")
ans = os.path.join(dl, "78회 한국사_답지(심화).pdf")
qz  = os.path.join(dl, "78회 한국사_문제지(심화).pdf")

da = fitz.open(ans)
print("=== ANSWER KEY pages:", da.page_count)
for i in range(min(da.page_count,3)):
    t = da[i].get_text().strip()
    print(f"--- ans p{i+1} len={len(t)} ---")
    print(t[:1500])

dq = fitz.open(qz)
print("\n=== QUESTION pages:", dq.page_count)
lens = [len(dq[i].get_text().strip()) for i in range(dq.page_count)]
print("text len per page (first 20):", lens[:20])
print("total text chars:", sum(lens))
