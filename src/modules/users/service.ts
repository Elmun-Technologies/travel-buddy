import "server-only";
import { and, eq, gt, inArray, lt, ne } from "drizzle-orm";
import { sessions, users } from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";

export async function createUser(tx: DbOrTx, locale: string) {
  const [u] = await tx.insert(users).values({ locale }).returning({ id: users.id });
  return u.id;
}

export async function getUserState(tx: DbOrTx, userId: string) {
  const [u] = await tx
    .select({ status: users.status, phoneVerified: users.phoneVerified })
    .from(users)
    .where(eq(users.id, userId));
  return u ?? null;
}

/** Still a live account? (Suspended and deleted people lose live connections too.) */
export async function isActiveUser(userId: string) {
  return (await getUserState(getDb(), userId))?.status === "active";
}

/** Of these ids, the accounts that are deleted (their names are no longer shown). */
export async function deletedAmong(userIds: string[]) {
  if (!userIds.length) return new Set<string>();
  const rows = await getDb()
    .select({ id: users.id })
    .from(users)
    .where(and(inArray(users.id, userIds), eq(users.status, "deleted")));
  return new Set(rows.map((r) => r.id));
}

export async function getPhoneVerified(userIds: string[]) {
  if (!userIds.length) return new Map<string, boolean>();
  const rows = await getDb()
    .select({ id: users.id, v: users.phoneVerified })
    .from(users)
    .where(inArray(users.id, userIds));
  return new Map(rows.map((r) => [r.id, r.v]));
}

/** Normalizes to +digits. */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
}

export type PhoneResult = "ok" | "phone_taken" | "invalid";

export async function markPhoneVerified(userId: string, rawPhone: string): Promise<PhoneResult> {
  const phone = normalizePhone(rawPhone);
  if (!phone) return "invalid";
  const db = getDb();
  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.phone, phone), eq(users.phoneVerified, true), ne(users.id, userId)));
  if (taken) return "phone_taken";
  await db.update(users).set({ phone, phoneVerified: true }).where(eq(users.id, userId));
  return "ok";
}

export async function getLocale(userId: string) {
  const [u] = await getDb().select({ locale: users.locale }).from(users).where(eq(users.id, userId));
  return u?.locale ?? null;
}

export async function setLocale(userId: string, locale: string) {
  await getDb().update(users).set({ locale }).where(eq(users.id, userId));
}

export async function getNotifyOff(userId: string) {
  const [u] = await getDb().select({ off: users.notifyOff }).from(users).where(eq(users.id, userId));
  return u?.off ?? [];
}

export async function setNotifyOff(userId: string, off: string[]) {
  await getDb().update(users).set({ notifyOff: off }).where(eq(users.id, userId));
}

/** Grant or take away admin (only travelers/admins switch; agency members are untouched). */
export async function setAdminRole(userId: string, admin: boolean) {
  await getDb()
    .update(users)
    .set({ role: admin ? "admin" : "traveler" })
    .where(and(eq(users.id, userId), eq(users.role, admin ? "traveler" : "admin")));
}

/** Marks the account deleted (kept 30 days for a change of mind). False if it was not active. */
export async function markDeleted(tx: DbOrTx, userId: string) {
  const r = await tx
    .update(users)
    .set({ status: "deleted", deletedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.status, "active")))
    .returning({ id: users.id });
  return r.length > 0;
}

export async function endAllSessions(tx: DbOrTx, userId: string) {
  await tx.delete(sessions).where(eq(sessions.userId, userId));
}

const ERASE_AFTER_MS = 30 * 86_400_000;

/** Signing in within 30 days of deleting brings the account back. Returns true if restored. */
export async function restoreUser(tx: DbOrTx, userId: string) {
  const r = await tx
    .update(users)
    .set({ status: "active", deletedAt: null })
    .where(
      and(
        eq(users.id, userId),
        eq(users.status, "deleted"),
        gt(users.deletedAt, new Date(Date.now() - ERASE_AFTER_MS)),
      ),
    )
    .returning({ id: users.id });
  return r.length > 0;
}

/** Accounts whose 30 days are over. */
export async function listErasable(db: DbOrTx) {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.status, "deleted"), lt(users.deletedAt, new Date(Date.now() - ERASE_AFTER_MS))));
  return rows.map((r) => r.id);
}

/**
 * Erases one account for good. Personal rows go with it (cascade); what belongs to the group
 * stays without a name: trips, messages, plans, polls (set null). Expenses the person paid and
 * their settlements are removed with them — the group's remaining debts are between the others.
 */
export async function eraseUser(db: DbOrTx, userId: string) {
  await db.delete(users).where(and(eq(users.id, userId), eq(users.status, "deleted")));
}
