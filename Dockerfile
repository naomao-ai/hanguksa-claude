# 한국사 마스터 — 프로덕션 이미지 (Next.js 16 + Firebase)
FROM node:22-bookworm-slim

WORKDIR /app

# TLS 안정화용 (slim 이미지 인증서 보강)
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 의존성 설치 (캐시 최적화). 불필요한 postinstall 스크립트는 --ignore-scripts로 차단.
COPY package*.json ./
RUN npm ci --ignore-scripts

# 소스 복사 후 프로덕션 빌드
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN npm run build

ENV NODE_ENV=production
# Cloud Run은 런타임에 $PORT(기본 8080)를 주입하며, 컨테이너는 그 포트로 리스닝해야 함.
# -p 를 하드코딩하지 않고 $PORT를 사용(미설정 시 8080 기본)해야 헬스체크를 통과한다.
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p ${PORT:-8080}"]
