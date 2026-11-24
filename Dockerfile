# syntax=docker/dockerfile:1
# Built in GitHub Actions (linux/arm64), never on the shared server.
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Brand name is baked into static pages at build time.
# GIT_SHA → deploymentId (version-skew detection + "update" banner).
# Server Actions key: stable across builds so pages opened before a deploy still work.
# Passed as a BuildKit secret, so it is not stored in image history.
ARG APP_NAME
ARG APP_URL
ARG GIT_SHA
ARG NEXT_PUBLIC_SENTRY_DSN
ENV APP_NAME=$APP_NAME APP_URL=$APP_URL NEXT_DEPLOYMENT_ID=$GIT_SHA NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=sa_key,env=NEXT_SERVER_ACTIONS_ENCRYPTION_KEY pnpm build && pnpm worker:build

FROM node:22-alpine AS web
WORKDIR /app
ARG GIT_SHA
ENV NEXT_DEPLOYMENT_ID=$GIT_SHA
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache curl
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]

FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache curl
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
USER node
# RUN_MIGRATIONS=true (staging): migrate first, refuse to start on failure.
# Production keeps it false and runs `node dist/migrate.mjs` as a manual step.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" = \"true\" ]; then node dist/migrate.mjs || exit 1; fi; exec node dist/index.mjs"]
