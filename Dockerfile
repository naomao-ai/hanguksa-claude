# 한국사 마스터 — 프로덕션 이미지 (Next.js 16 + Prisma + SQLite)
FROM node:22-bookworm-slim

WORKDIR /app

# Prisma 엔진에 필요한 openssl
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# 의존성 설치 (캐시 최적화)
COPY package*.json ./
RUN npm ci

# 소스 복사 후 Prisma 클라이언트 생성 + 프로덕션 빌드
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=3000
# SQLite DB 영속화: 이 경로를 볼륨으로 마운트하세요
VOLUME ["/app/prisma"]
EXPOSE 3000

# 시작 시 스키마 동기화(없으면 DB 생성) 후 프로덕션 서버 기동.
# SEED_ON_START=1 이면 샘플 데이터도 적재.
CMD ["sh", "-c", "npx prisma db push --skip-generate && ([ \"$SEED_ON_START\" = \"1\" ] && node --experimental-strip-types prisma/seed.ts || true) && node node_modules/next/dist/bin/next start -H 0.0.0.0 -p 3000"]
