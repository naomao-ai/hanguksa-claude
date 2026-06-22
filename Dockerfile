# 한국사 마스터 — 프로덕션 이미지 (Next.js 16 + Firebase)
FROM node:22-bookworm-slim

WORKDIR /app

# Prisma 엔진 postinstall(prisma generate)에 필요한 openssl
# (앱 런타임은 Firebase만 쓰지만, devDeps의 prisma가 설치 시 generate를 실행)
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# 의존성 설치 (캐시 최적화)
COPY package*.json ./
RUN npm ci

# 소스 복사 후 프로덕션 빌드
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
