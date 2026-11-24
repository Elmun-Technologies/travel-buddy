import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const g = globalThis as unknown as { db?: PostgresJsDatabase<typeof schema>; sql?: postgres.Sql };

// Lazy so `next build` works without DATABASE_URL.
export function getDb() {
  if (!g.db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    // Small pool: shared 8 GB server (the database allows 50 connections in total).
    // The timeouts make a stuck lock or a forgotten transaction fail instead of hanging the pool.
    g.sql = postgres(url, {
      max: 10,
      idle_timeout: 30,
      connection: { lock_timeout: 10_000, idle_in_transaction_session_timeout: 30_000 },
    });
    g.db = drizzle({ client: g.sql, schema });
  }
  return g.db;
}

/** Raw client, only for LISTEN/NOTIFY (room live updates). */
export function getSql() {
  getDb();
  return g.sql!;
}

export type Db = ReturnType<typeof getDb>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;
