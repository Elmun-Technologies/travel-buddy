import "server-only";
import { and, asc, eq, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { idVerifications, travelerProfiles } from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { getDisplayNames } from "@/modules/profiles/service";

/** Photos of the document and the selfie are kept this long after the decision, then erased. */
export const KEEP_FILES_DAYS = 30;

export type IdStatus = "none" | "pending" | "approved" | "rejected";

export async function myIdStatus(userId: string): Promise<IdStatus> {
  const [v] = await getDb()
    .select({ status: idVerifications.status })
    .from(idVerifications)
    .where(eq(idVerifications.userId, userId))
    .orderBy(sql`${idVerifications.createdAt} desc`)
    .limit(1);
  return v?.status ?? "none";
}

/**
 * Send the two pictures for a manual check. An earlier pending request is replaced (its files go);
 * an approved person cannot send again. Returns the keys that must be deleted from storage.
 */
export async function submitId(userId: string, docKey: string, selfieKey: string) {
  return getDb().transaction(async (tx) => {
    const rows = await tx.select().from(idVerifications).where(eq(idVerifications.userId, userId));
    if (rows.some((r) => r.status === "approved")) return { ok: false as const, stale: [docKey, selfieKey] };
    const stale = rows
      .flatMap((r) => (r.status === "pending" ? [r.documentKey, r.selfieKey] : []))
      .filter(Boolean) as string[];
    await tx
      .delete(idVerifications)
      .where(and(eq(idVerifications.userId, userId), eq(idVerifications.status, "pending")));
    await tx.insert(idVerifications).values({ userId, documentKey: docKey, selfieKey, status: "pending" });
    return { ok: true as const, stale };
  });
}

export async function listPendingIds() {
  const rows = await getDb()
    .select({ id: idVerifications.id, userId: idVerifications.userId, createdAt: idVerifications.createdAt })
    .from(idVerifications)
    .where(eq(idVerifications.status, "pending"))
    .orderBy(asc(idVerifications.createdAt))
    .limit(100);
  const names = await getDisplayNames(rows.map((r) => r.userId));
  return rows.map((r) => ({ ...r, name: names.get(r.userId) ?? "—" }));
}

/** Storage key of one picture of a request (admin routes only). */
export async function idFileKey(id: string, kind: "doc" | "selfie") {
  const [v] = await getDb()
    .select({ doc: idVerifications.documentKey, selfie: idVerifications.selfieKey })
    .from(idVerifications)
    .where(eq(idVerifications.id, id));
  return (kind === "doc" ? v?.doc : v?.selfie) ?? null;
}

/** Admin decision; approving also lights the "ID ✓" mark on the profile. Runs inside the admin op's transaction. */
export async function decideId(tx: DbOrTx, adminId: string, id: string, approve: boolean) {
  const [v] = await tx
    .update(idVerifications)
    .set({ status: approve ? "approved" : "rejected", reviewedBy: adminId, reviewedAt: new Date() })
    .where(and(eq(idVerifications.id, id), eq(idVerifications.status, "pending")))
    .returning({ userId: idVerifications.userId });
  if (!v) return null;
  if (approve)
    await tx.update(travelerProfiles).set({ idVerified: true }).where(eq(travelerProfiles.userId, v.userId));
  return v.userId;
}

/** Daily (worker): erase pictures of requests decided more than 30 days ago; only the status stays. */
export async function purgeDecidedIdFiles() {
  const rows = await getDb()
    .select({ id: idVerifications.id, doc: idVerifications.documentKey, selfie: idVerifications.selfieKey })
    .from(idVerifications)
    .where(
      and(
        isNotNull(idVerifications.reviewedAt),
        isNull(idVerifications.filesPurgedAt),
        lt(idVerifications.reviewedAt, new Date(Date.now() - KEEP_FILES_DAYS * 86_400_000)),
      ),
    );
  for (const r of rows) {
    await deleteFile(r.doc);
    await deleteFile(r.selfie);
    await getDb()
      .update(idVerifications)
      .set({ documentKey: null, selfieKey: null, filesPurgedAt: new Date() })
      .where(eq(idVerifications.id, r.id));
  }
  return rows.length;
}
