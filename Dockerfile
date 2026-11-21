# Multi-stage production build for Lumina Specialized Hospital
# Builds frontend (real API mode) + backend and serves both from one Node.js container.

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/

RUN npm ci

COPY packages/shared packages/shared
COPY apps/web apps/web
COPY apps/api apps/api

ENV VITE_API_MOCK=false
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV SERVE_STATIC=true

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/

RUN npm ci --omit=dev --workspace=@inovexa/shared --workspace=@inovexa/api

COPY packages/shared/src packages/shared/src
COPY apps/api/db apps/api/db
COPY apps/api/prisma apps/api/prisma
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/web/dist apps/web/dist

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health || exit 1

CMD ["node", "apps/api/dist/server.js"]
