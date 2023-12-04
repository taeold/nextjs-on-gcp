FROM node:20.5.1-bookworm-slim
WORKDIR /app

ARG BUILD_ID
ENV NODE_ENV=production \
    BUILD_ID=$BUILD_ID \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

RUN mkdir .next
RUN chown nextjs:nodejs .next

COPY --chown=nextjs:nodejs .next/standalone ./
COPY --chown=nextjs:nodejs .next/static ./.next/static

USER nextjs
CMD ["node", "server.js"]
