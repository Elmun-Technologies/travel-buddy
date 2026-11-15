import "server-only";
import { and, eq, or } from "drizzle-orm";
import { blocks, reports } from "@/db/schema";
import { getDb } from "@/lib/db";

/** Users hidden from `userId` everywhere: blocked by them or blocking them. */
export async function getBlockedIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  const rows = await getDb()
    .select({ a: blocks.blockerId, b: blocks.blockedId })
    .from(blocks)
    .where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
  return rows.map((r) => (r.a === userId ? r.b : r.a));
}

export async function isBlockedBetween(a: string, b: string) {
  const [row] = await getDb()
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)),
        and(eq(blocks.blockerId, b), eq(blocks.blockedId, a)),
      ),
    );
  return !!row;
}

export const REPORT_REASONS = ["fake", "dating", "unsafe", "other"] as const;

/** One open report per reporter and target is enough (repeat taps are ignored). */
export async function createReport(
  reporterId: string,
  targetType: "user" | "trip" | "message",
  targetId: string,
  reason: (typeof REPORT_REASONS)[number],
) {
  const db = getDb();
  const [dup] = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(eq(reports.reporterId, reporterId), eq(reports.targetId, targetId), eq(reports.status, "open")),
    );
  if (!dup) await db.insert(reports).values({ reporterId, targetType, targetId, reason });
}

export async function block(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) return;
  await getDb().insert(blocks).values({ blockerId, blockedId }).onConflictDoNothing();
}

export async function unblock(blockerId: string, blockedId: string) {
  await getDb()
    .delete(blocks)
    .where(and(eq(blocks.blockerId, blockerId), eq(blocks.blockedId, blockedId)));
}
