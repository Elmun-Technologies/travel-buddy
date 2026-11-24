import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";

/**
 * Daily (worker): drop what only grows. Expired rate-limit counters and sessions, and messages
 * already delivered (or given up on) more than 30 days ago.
 */
export async function purgeStale(db: Db) {
  await db.execute(sql`delete from rate_limits where expires_at < now() - interval '1 hour'`);
  await db.execute(sql`delete from sessions where expires_at < now()`);
  await db.execute(sql`
    delete from notifications
    where created_at < now() - interval '30 days' and (sent_at is not null or attempts >= 6)`);
}
