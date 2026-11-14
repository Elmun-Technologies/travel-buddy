// Background process: pg-boss jobs + Telegram bot.
import { setTimeout as sleep } from "node:timers/promises";
import * as Sentry from "@sentry/node";
import { PgBoss } from "pg-boss";
import { getDb } from "@/lib/db";
import { createBot } from "./bot";
import { deliverNotifications, queueDigests } from "./notify";
import { runReliability } from "./reliability";
import { SEED_ENVS, seedSamples } from "./seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

// Errors only; no DSN → off. Uncaught errors are reported by the SDK's default handlers.
if (process.env.SENTRY_DSN)
  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.APP_ENV, tracesSampleRate: 0 });

const boss = new PgBoss({ connectionString: url, max: 3 });
boss.on("error", (e) => {
  console.error("pg-boss error", e);
  Sentry.captureException(e);
});
await boss.start();
console.log("worker started");

// Staging/development only: sample trips marked "Namuna" (is_test). Production never seeds.
if (SEED_ENVS.includes(process.env.APP_ENV ?? "")) {
  await seedSamples(getDb())
    .then((n) => console.log(`sample trips ready: ${n}`))
    .catch((e) => console.error("seed failed", e));
}

let stopping = false;
let current: ReturnType<typeof createBot> | null = null;

/** Keeps the bot alive without taking pg-boss down: log, back off (5s → 5min), retry. */
async function runBot(token: string) {
  for (let attempt = 0; !stopping; attempt++) {
    try {
      current = createBot(token, process.env.APP_URL ?? "", process.env.TELEGRAM_API_ROOT || undefined);
      await current.start(); // resolves only when stopped
      return;
    } catch (e) {
      if (stopping) return;
      const delay = Math.min(300_000, 5_000 * 2 ** Math.min(attempt, 6));
      console.error(`bot failed (attempt ${attempt + 1}), retrying in ${delay / 1000}s`, e);
      Sentry.captureException(e);
      await sleep(delay);
    }
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (token) void runBot(token);
else console.log("TELEGRAM_BOT_TOKEN not set: bot disabled");

// Telegram notifications queued by the web app (join requested / approved), every 5 s.
let delivering = false;
let lastDigest = 0;
let lastReliability = 0;
const deliveryTimer = setInterval(async () => {
  if (!current || delivering) return;
  delivering = true;
  try {
    if (Date.now() - lastDigest > 60_000) {
      lastDigest = Date.now();
      await queueDigests(getDb()); // chat: at most one "N ta yangi xabar" an hour per room
    }
    if (Date.now() - lastReliability > 3_600_000) {
      lastReliability = Date.now();
      await runReliability(getDb()); // ticket deadlines, "N/N safarga bordi"
    }
    await deliverNotifications(current.bot.api, getDb(), process.env.APP_URL ?? "");
  } catch (e) {
    console.error("notification delivery failed", e);
    Sentry.captureException(e);
  } finally {
    delivering = false;
  }
}, 5_000);

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    console.log(`${sig}: stopping worker`);
    stopping = true;
    clearInterval(deliveryTimer);
    await current?.bot.stop().catch(() => {});
    await boss.stop({ graceful: true, timeout: 20_000 });
    await Sentry.flush(2_000);
    process.exit(0);
  });
}
