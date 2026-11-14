import * as Sentry from "@sentry/nextjs";

// NEXT_PUBLIC_* is inlined at build time (GitHub Actions), so the DSN is a build variable.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn)
  Sentry.init({
    dsn,
    environment: location.hostname, // staging vs production domain
    tracesSampleRate: 0,
  });
