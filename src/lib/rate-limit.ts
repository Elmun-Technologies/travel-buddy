import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "./db";

/** Fixed-window counter in Postgres. Returns true if the call is allowed. */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const windowStart = Math.floor(Date.now() / 1000 / windowSec) * windowSec;
  const rows = await getDb().execute<{ count: number }>(sql`
    insert into rate_limits (key, count, expires_at)
    values (${`${key}:${windowStart}`}, 1, to_timestamp(${windowStart + windowSec}))
    on conflict (key) do update set count = rate_limits.count + 1
    returning count`);
  // ponytail: expired rows are cleaned by a worker job later (phase 4); table stays tiny until then.
  return rows[0].count <= limit;
}
