// Background process: pg-boss jobs + Telegram bot.
import { setTimeout as sleep } from "node:timers/promises";
import * as Sentry from "@sentry/node";
import { PgBoss } from "pg-boss";
import { getDb } from "@/lib/db";
import { createBot } from "./bot";
import { deliverNotifications, queueDigests } from "./notify";
import { queueCreatorInvites } from "./creator";
import { runMatching } from "@/modules/matching/jobs";
import { runReliability } from "./reliability";
import { eraseDeletedAccounts } from "@/modules/account/service";
import { purgeStale } from "@/modules/housekeeping/service";
import { SEED_ENVS, seedSamples } from "./seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");
// An unset or misspelled APP_ENV would flag real data as test data. Refuse to start instead.
if (!["development", "staging", "production", "test"].includes(process.env.APP_ENV ?? ""))
  throw new Error(`APP_ENV must be development, staging or production (got "${process.env.APP_ENV ?? ""}")`);

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
let lastCleanup = 0;
let lastMatching = 0;
let inFlight: Promise<unknown> = Promise.resolve();

/** Jobs that do not need Telegram (they must keep running if the bot token is missing or the bot is down). */
async function housekeeping() {
  if (Date.now() - lastReliability > 3_600_000) {
    lastReliability = Date.now();
    await runReliability(getDb()); // ticket deadlines, "N/N safarga bordi"
    if (process.env.CREATOR_ENABLED === "1") await queueCreatorInvites(getDb()); // 1M Safar, day 2
  }
  if (Date.now() - lastMatching > 900_000) {
    lastMatching = Date.now();
    await runMatching(getDb()); // new trips ↔ people whose plans fit (≤ 3 bot messages a day each)
  }
  if (Date.now() - lastCleanup > 86_400_000) {
    lastCleanup = Date.now();
    const r = await eraseDeletedAccounts(getDb(), (e, id) => {
      console.error(`could not erase account ${id}`, e);
      Sentry.captureException(e);
    });
    if (r.erased || r.failed) console.log(`accounts erased: ${r.erased}, failed: ${r.failed}`);
    await purgeStale(getDb());
  }
}

const deliveryTimer = setInterval(() => {
  if (delivering) return;
  delivering = true;
  inFlight = tick().finally(() => (delivering = false));
}, 5_000);

async function tick() {
  try {
    await housekeeping();
  } catch (e) {
    console.error("housekeeping failed", e);
    Sentry.captureException(e);
  }
  if (!current) return;
  try {
    if (Date.now() - lastDigest > 60_000) {
      lastDigest = Date.now();
      await queueDigests(getDb()); // chat: at most one "N ta yangi xabar" an hour per room
    }
    await deliverNotifications(current.bot.api, getDb(), process.env.APP_URL ?? "");
  } catch (e) {
    console.error("notification delivery failed", e);
    Sentry.captureException(e);
  }
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    console.log(`${sig}: stopping worker`);
    stopping = true;
    clearInterval(deliveryTimer);
    await Promise.race([inFlight, sleep(15_000)]); // let the batch in flight finish
    await current?.bot.stop().catch(() => {});
    await boss.stop({ graceful: true, timeout: 20_000 });
    await Sentry.flush(2_000);
    process.exit(0);
  });
}
