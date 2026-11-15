import "server-only";
import { and, eq, inArray, lt, ne } from "drizzle-orm";
import { users } from "@/db/schema";
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

/** Soft-delete the current user's account (GDPR). Worker hard-deletes after 30 days. */
export async function deleteUser(userId: string) {
  await getDb()
    .update(users)
    .set({ status: "deleted", deletedAt: new Date() })
    .where(eq(users.id, userId));
}

/** Restore a soft-deleted account if within 30 days. Returns true if restored. */
export async function restoreUser(tx: DbOrTx, userId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [u] = await tx
    .select({ id: users.id, status: users.status, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!u || u.status !== "deleted") return false;
  if (u.deletedAt && u.deletedAt < thirtyDaysAgo) return false;
  await tx
    .update(users)
    .set({ status: "active", deletedAt: null })
    .where(eq(users.id, userId));
  return true;
}

/** Hard-delete users whose soft-delete is older than 30 days. Runs in worker daily. */
export async function permanentlyDeleteUsers(tx: DbOrTx) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await tx
    .delete(users)
    .where(and(eq(users.status, "deleted"), lt(users.deletedAt, thirtyDaysAgo)));
}
