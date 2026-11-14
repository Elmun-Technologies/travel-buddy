import "server-only";
import { count, inArray, sql } from "drizzle-orm";
import { reliability } from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";

/** userId → trips gone / trips counted ("N/N safarga bordi"). Only people with at least one outcome. */
export async function getReliability(userIds: string[]) {
  if (!userIds.length) return new Map<string, { went: number; total: number }>();
  const rows = await getDb()
    .select({
      userId: reliability.userId,
      total: count(),
      went: sql<number>`count(*) filter (where ${reliability.outcome} = 'went')`.mapWith(Number),
    })
    .from(reliability)
    .where(inArray(reliability.userId, userIds))
    .groupBy(reliability.userId);
  return new Map(rows.map((r) => [r.userId, { went: r.went, total: r.total }]));
}

/** Leaving after the ticket deadline counts as not going (the group planned around them). */
export async function recordNoShow(tx: DbOrTx, userId: string, tripId: string) {
  await tx.insert(reliability).values({ userId, tripId, outcome: "no_show" }).onConflictDoNothing();
}
