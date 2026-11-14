// Background process: pg-boss jobs + Telegram bot.
import { setTimeout as sleep } from "node:timers/promises";
import { PgBoss } from "pg-boss";
import { createBot } from "./bot";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const boss = new PgBoss({ connectionString: url, max: 3 });
boss.on("error", (e) => console.error("pg-boss error", e));
await boss.start();
console.log("worker started");

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
      await sleep(delay);
    }
  }
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (token) void runBot(token);
else console.log("TELEGRAM_BOT_TOKEN not set: bot disabled");

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    console.log(`${sig}: stopping worker`);
    stopping = true;
    await current?.bot.stop().catch(() => {});
    await boss.stop({ graceful: true, timeout: 20_000 });
    process.exit(0);
  });
}
