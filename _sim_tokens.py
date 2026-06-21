import os, glob, json
from PIL import Image

# Anthropic 비전 토큰 근사: 긴 변이 1568px 넘으면 축소 후 tokens = w*h/750
def img_tokens(path, cap=1568):
    w, h = Image.open(path).size
    if max(w, h) > cap:
        s = cap / max(w, h)
        w, h = int(w * s), int(h * s)
    return (w * h) / 750

def ko_tokens(text):  # 한국어 근사: 1.3자/토큰
    return len(text) / 1.3

# ---- 입력 이미지 ----
pages = sorted(glob.glob("_pdf78/p*.png"))            # 12 페이지 (AI 업로드)
quads = sorted(glob.glob("_pdf78_q/p*_*.png"))         # 48 사분면 (수기: 문항당 1장)

page_tok = sum(img_tokens(p) for p in pages)
quad_avg = sum(img_tokens(q) for q in quads) / len(quads)

# ---- 텍스트 오버헤드 ----
SYSTEM = 320      # ANALYZE_SYSTEM(대략)
TOOL = 750        # 도구 스키마(JSON)
INSTR = 40        # 지시문

# ---- 출력(문항 구조화 JSON) 추정: 기존 시드 평균 문항 길이로 ----
# 평균 문항 텍스트(발문+사료+선지+태그) 길이 가정
avg_q_chars = 420                  # 발문+사료+5선지+해설/태그 합 평균
out_per_q = ko_tokens(str(avg_q_chars * "a")[:avg_q_chars]) if False else avg_q_chars / 1.3
N = 50

print("=== 입력 이미지 토큰 ===")
print(f"AI 업로드: 12페이지 합 = {page_tok:,.0f} tok (페이지당 ~{page_tok/12:,.0f})")
print(f"수기 전사: 사분면 평균 {quad_avg:,.0f} tok × {N}문항 = {quad_avg*N:,.0f} tok")

# ---- AI 업로드 방식 (사용자 API, 단발 처리, 8장/콜 → 2콜) ----
ai_in = page_tok + 2 * (SYSTEM + TOOL + INSTR)
ai_out = out_per_q * N
print("\n=== [A] AI 업로드 (Anthropic API / 사용자 크레딧) ===")
print(f"입력 ~{ai_in:,.0f} tok, 출력 ~{ai_out:,.0f} tok, 왕복 2콜")

# ---- 수기 전사 방식 (에이전트 루프: 매 턴 컨텍스트 재전송) ----
# 문항당: 이미지 1장 읽기 + 전사 출력. 추가로 매 턴 누적 컨텍스트 재처리(캐시 0.1x 가정).
turns = 60                          # 50문항 + 시드편집/검증 등 대략 턴 수
ctx_avg = 45000                     # 진행 중 평균 컨텍스트 크기(누적)
cache_hit = 0.8                     # 캐시 적중 비율
# 유효 입력 = 캐시미스(1x) + 캐시히트(0.1x)
ctx_effective = turns * ctx_avg * ((1 - cache_hit) * 1.0 + cache_hit * 0.1)
man_images = quad_avg * N
man_out = out_per_q * N + turns * 250   # 전사 + 매 턴 내레이션/코드
man_in = man_images + ctx_effective + turns * INSTR
print("\n=== [B] 수기 전사 (Claude Code 세션 토큰) ===")
print(f"이미지 입력 ~{man_images:,.0f} + 컨텍스트 재처리(유효) ~{ctx_effective:,.0f} = 입력 ~{man_in:,.0f} tok")
print(f"출력 ~{man_out:,.0f} tok, 왕복 ~{turns}턴")

# ---- 비용(모델별 $/MTok) ----
price = {"Opus 4.8": (5, 25), "Sonnet 4.6": (3, 15), "Haiku 4.5": (1, 5)}
def cost(inp, out, m):
    pi, po = price[m]
    return inp/1e6*pi + out/1e6*po

print("\n=== 비용 비교 (USD) ===")
for m in price:
    print(f"{m:11} | A(AI업로드) ${cost(ai_in, ai_out, m):.3f} | B(수기) ${cost(man_in, man_out, m):.3f}")

print("\n=== 총 토큰 요약 ===")
print(f"A(AI 업로드): ~{ai_in+ai_out:,.0f} tok")
print(f"B(수기 전사): ~{man_in+man_out:,.0f} tok  (A의 {(man_in+man_out)/(ai_in+ai_out):.1f}배)")
