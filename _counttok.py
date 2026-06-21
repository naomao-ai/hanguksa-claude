import os, json, base64, urllib.request, re

# .env.local에서 키 로드
key = ""
for line in open(os.path.join(os.path.dirname(__file__), ".env.local"), encoding="utf-8"):
    m = re.match(r"^ANTHROPIC_API_KEY=(.*)$", line.strip())
    if m:
        key = m.group(1).strip()

def b64(path):
    return base64.b64encode(open(path, "rb").read()).decode()

def count(content_blocks, system="", tools=None):
    body = {"model": "claude-opus-4-8", "messages": [{"role": "user", "content": content_blocks}]}
    if system:
        body["system"] = system
    if tools:
        body["tools"] = tools
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages/count_tokens",
        data=json.dumps(body).encode(),
        headers={"x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json"},
        method="POST",
    )
    try:
        r = urllib.request.urlopen(req, timeout=60)
        return json.load(r)["input_tokens"]
    except urllib.error.HTTPError as e:
        return f"HTTP {e.code}: {e.read().decode()[:200]}"

def img_block(path):
    return {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": b64(path)}}

# 1) 텍스트만(오버헤드 기준)
print("text-only(빈):", count([{"type": "text", "text": "위 이미지의 모든 문항을 추출하세요."}]))

# 2) 전체 페이지 1장 (AI 업로드 방식)
page = "_pdf78/p01.png"
print("page1 image:", count([img_block(page), {"type": "text", "text": "위 이미지의 모든 문항을 추출하세요."}]))

# 3) 사분면 크롭 1장 (수기 전사 시 내가 읽는 단위)
quad = "_pdf78_q/p01_TL.png"
print("quadrant image:", count([img_block(quad), {"type": "text", "text": "이 문항을 읽어줘."}]))

# 4) 고해상 단일문항 크롭
hi = "_pdf78_hi/p01_q1.png"
if os.path.exists(hi):
    print("hi q1 image:", count([img_block(hi), {"type": "text", "text": "이 문항을 읽어줘."}]))
