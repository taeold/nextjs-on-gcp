FROM node:20.5.1-bookworm-slim AS base

FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG BUILD_ID
ARG FIREBASE_CONFIG
ENV NODE_ENV=production \
    BUILD_ID=$BUILD_ID \
    FIREBASE_CONFIG=$FIREBASE_CONFIG \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

FROM base AS runner
WORKDIR /app
COPY --from=builder /app/public ./public

RUN mkdir .next

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
CMD ["node", "server.js"]
