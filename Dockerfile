FROM node:20.5.1-bookworm-slim

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --chown=nextjs:nodejs package.json package-lock.json ./
RUN npm ci

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --chown=nextjs:nodejs . .
RUN npm run build

RUN chown nextjs:nodejs .

USER nextjs
CMD ["npm", "run", "start"]
