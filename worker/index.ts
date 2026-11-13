// Background process: pg-boss jobs now, grammY bot from phase 2.
import { PgBoss } from "pg-boss";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const boss = new PgBoss({ connectionString: url, max: 3 });
boss.on("error", (e) => console.error("pg-boss error", e));
await boss.start();
console.log("worker started");

for (const sig of ["SIGTERM", "SIGINT"] as const) {
  process.on(sig, async () => {
    console.log(`${sig}: stopping worker`);
    await boss.stop({ graceful: true, timeout: 20_000 });
    process.exit(0);
  });
}
