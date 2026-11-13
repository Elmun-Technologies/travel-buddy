# Built in GitHub Actions (linux/arm64), never on the shared server.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Brand name is baked into static pages at build time.
ARG APP_NAME
ENV APP_NAME=$APP_NAME NEXT_TELEMETRY_DISABLED=1
RUN pnpm build && pnpm worker:build

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]

FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
USER node
# RUN_MIGRATIONS=true (staging): migrate first, refuse to start on failure.
# Production keeps it false and runs `node dist/migrate.mjs` as a manual step.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then node dist/migrate.mjs || exit 1; fi; exec node dist/index.mjs"]
