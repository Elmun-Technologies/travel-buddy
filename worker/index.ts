// Background process: pg-boss jobs + Telegram bot.
import { PgBoss } from "pg-boss";
import { createBot } from "./bot";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const boss = new PgBoss({ connectionString: url, max: 3 });
boss.on("error", (e) => console.error("pg-boss error", e));
await boss.start();
console.log("worker started");

const token = process.env.TELEGRAM_BOT_TOKEN;
const tg = token ? createBot(token, process.env.APP_URL ?? "") : null;
if (tg) {
  // If polling dies (e.g. 409: another instance uses the token), exit so the container restarts.
  tg.start().catch((e) => {
    console.error("bot stopped", e);
    process.exit(1);
  });
} else {
  console.log("TELEGRAM_BOT_TOKEN not set: bot disabled");
}

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    console.log(`${sig}: stopping worker`);
    await tg?.bot.stop();
    await boss.stop({ graceful: true, timeout: 20_000 });
    process.exit(0);
  });
}
