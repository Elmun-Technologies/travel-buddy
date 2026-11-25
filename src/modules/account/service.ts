import "server-only";
import { sql } from "drizzle-orm";
import { type Db, getDb } from "@/lib/db";
import { deleteFile } from "@/lib/storage";
import { leaveAllTrips } from "@/modules/groups/service";
import { dropUnsent } from "@/modules/notifications/service";
import { revokeAllFamilyLinks } from "@/modules/safety/service";
import { closeOwnedListings } from "@/modules/trips/service";
import { endAllSessions, eraseUser, listErasable, markDeleted } from "@/modules/users/service";

/**
 * "Akkauntni o'chirish". The person disappears at once: signed out everywhere, listings closed,
 * seats in other groups freed, family links dead, no more bot messages. The row itself stays for
 * 30 days (signing in again restores the account), then the worker erases it for good.
 */
export async function deleteAccount(userId: string) {
  await getDb().transaction(async (tx) => {
    if (!(await markDeleted(tx, userId))) return;
    await endAllSessions(tx, userId);
    await closeOwnedListings(tx, userId);
    await leaveAllTrips(tx, userId);
    await revokeAllFamilyLinks(tx, userId);
    await dropUnsent(tx, userId);
  });
}

/** Pictures a person uploaded (profile, albums, chats, ID check) leave storage with the account. */
async function eraseUserFiles(db: Db, userId: string) {
  const rows = await db.execute<{ key: string | null }>(sql`
    select avatar_key as key from traveler_profiles where user_id = ${userId}
    union all select key from trip_photos where user_id = ${userId}
    union all select image_key from messages where sender_id = ${userId} and image_key is not null
    union all select document_key from id_verifications where user_id = ${userId}
    union all select selfie_key from id_verifications where user_id = ${userId}`);
  for (const r of rows) await deleteFile(r.key);
  await db.execute(sql`delete from messages where sender_id = ${userId} and kind = 'image'`);
}

/**
 * Daily (worker): erase accounts deleted more than 30 days ago. One person at a time, so a single
 * failure never blocks the rest. Returns how many were erased and how many failed.
 */
export async function eraseDeletedAccounts(db: Db, onError: (e: unknown, userId: string) => void) {
  let erased = 0;
  let failed = 0;
  for (const id of await listErasable(db)) {
    try {
      await eraseUserFiles(db, id);
      await eraseUser(db, id);
      erased++;
    } catch (e) {
      failed++;
      onError(e, id);
    }
  }
  return { erased, failed };
}
