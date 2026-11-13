import { sql } from "drizzle-orm";
import { connection } from "next/server";
import { getDb } from "@/lib/db";

// Used by Coolify healthcheck. 200 = app + DB ok, 503 = DB unreachable.
export async function GET() {
  await connection();
  try {
    await getDb().execute(sql`select 1`);
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unreachable" }, { status: 503 });
  }
}
