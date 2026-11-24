import "server-only";
import { type Db, getDb } from "@/lib/db";
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

/**
 * Daily (worker): erase accounts deleted more than 30 days ago. One person at a time, so a single
 * failure never blocks the rest. Returns how many were erased and how many failed.
 */
export async function eraseDeletedAccounts(db: Db, onError: (e: unknown, userId: string) => void) {
  let erased = 0;
  let failed = 0;
  for (const id of await listErasable(db)) {
    try {
      await eraseUser(db, id);
      erased++;
    } catch (e) {
      failed++;
      onError(e, id);
    }
  }
  return { erased, failed };
}
