# @dadeul/api 컨테이너 이미지 (Cloud Run asia-northeast1)
#
# 빌드 컨텍스트는 저장소 루트다 — npm workspace라 lockfile이 루트에만 있다.
# 표준 경로는 Cloud Build다 (루트 cloudbuild.yaml, 로컬 docker 불필요):
#   gcloud builds submit --config cloudbuild.yaml --substitutions=_IMAGE=<image>
# 로컬에서 직접 빌드할 때:
#   docker build -f apps/api/Dockerfile -t <image> .
#
# Cloud Run 컨테이너 계약:
#   - PORT를 주입한다 → config.ts의 zod가 env에서 coerce하므로 코드 변경 불필요
#   - 0.0.0.0 바인딩 필수 → server.ts가 이미 그렇게 listen한다
#   - SIGTERM 후 10초 뒤 SIGKILL → server.ts의 그레이스풀 셧다운이 처리한다.
#     그래서 셸을 거치지 않는 exec 형식 CMD로 실행한다 (셸이 끼면 시그널이 전달되지 않는다)

# ── 빌드: 소스 → dist
FROM node:22-alpine AS builder
WORKDIR /app

# 의존성 레이어를 소스와 분리해 캐시가 소스 변경에 깨지지 않게 한다
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci

COPY apps/api/tsconfig.json apps/api/
COPY apps/api/src apps/api/src
RUN npm run build --workspace @dadeul/api

# ── 런타임 의존성만 따로 설치 (devDependencies 제외)
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm ci --omit=dev

# ── 실행 이미지
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
# 마이그레이션 SQL은 이미지에 포함한다 — 배포와 같은 이미지로 Cloud Run Job이 스키마·시드를 적용한다.
# dist/db/migrate.js가 import.meta.dirname 기준 ../../drizzle 을 읽으므로 위치가 이 구조여야 한다
COPY apps/api/drizzle ./drizzle
COPY apps/api/package.json ./package.json

USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
