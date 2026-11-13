import "server-only";
import { and, eq, or } from "drizzle-orm";
import { blocks } from "@/db/schema";
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
