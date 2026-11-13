import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const g = globalThis as unknown as { db?: PostgresJsDatabase<typeof schema> };

// Lazy so `next build` works without DATABASE_URL.
export function getDb() {
  if (!g.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // Small pool: shared 8 GB server.
    g.db = drizzle({ client: postgres(url, { max: 5, idle_timeout: 30 }), schema });
  }
  return g.db;
}
