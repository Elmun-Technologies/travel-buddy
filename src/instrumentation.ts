import * as Sentry from "@sentry/nextjs";

// Errors only (no tracing) to stay light on the shared server. No DSN → Sentry is off.
export async function register() {
  if (!process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.APP_ENV ?? "development",
    release: process.env.NEXT_DEPLOYMENT_ID,
    tracesSampleRate: 0,
  });
}

export const onRequestError = Sentry.captureRequestError;
