import "server-only";
import { and, count, eq, inArray, or, sql } from "drizzle-orm";
import { tripMembers, trips } from "@/db/schema";
import { todayISO } from "@/lib/catalog";
import { type DbOrTx, getDb } from "@/lib/db";
import { addTripChatMember, removeTripChatMember } from "@/modules/chat/service";
import { isBlockedBetween } from "@/modules/moderation/service";
import { notify } from "@/modules/notifications/service";
import { getDisplayNames, getJoinProfile } from "@/modules/profiles/service";
import { getReliability, recordNoShow } from "@/modules/reliability/service";
import { lockTripForJoin, setTripStatus } from "@/modules/trips/service";
import { getUserState } from "@/modules/users/service";
import { type JoinDenied, joinDenied } from "./rules";

export async function addOrganizer(tx: DbOrTx, tripId: string, userId: string) {
  await tx.insert(tripMembers).values({ tripId, userId, role: "organizer", status: "approved" });
}

export async function approvedCount(tx: DbOrTx, tripId: string) {
  const [r] = await tx
    .select({ n: count() })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.status, "approved")));
  return r.n;
}

/** Approved members of a trip except one person (the organizer), for fan-out notifications. */
export async function approvedMemberIds(tx: DbOrTx, tripId: string, exceptId: string) {
  const rows = await tx
    .select({ id: tripMembers.userId })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.status, "approved")));
  return rows.map((r) => r.id).filter((id) => id !== exceptId);
}

export async function countApproved(tripIds: string[]) {
  if (!tripIds.length) return new Map<string, number>();
  const rows = await getDb()
    .select({ tripId: tripMembers.tripId, n: count() })
    .from(tripMembers)
    .where(and(inArray(tripMembers.tripId, tripIds), eq(tripMembers.status, "approved")))
    .groupBy(tripMembers.tripId);
  return new Map(rows.map((r) => [r.tripId, r.n]));
}

/** tripId → my membership status (requested/approved only). */
export async function getMemberships(userId: string) {
  const rows = await getDb()
    .select({ tripId: tripMembers.tripId, status: tripMembers.status, role: tripMembers.role })
    .from(tripMembers)
    .where(and(eq(tripMembers.userId, userId), inArray(tripMembers.status, ["requested", "approved"])));
  return new Map(rows.map((r) => [r.tripId, { status: r.status, role: r.role }]));
}

export async function getMyMembership(userId: string, tripId: string) {
  const [m] = await getDb()
    .select({ status: tripMembers.status, role: tripMembers.role })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)));
  return m ?? null;
}

export type JoinResult =
  { ok: true } | { ok: false; error: JoinDenied | "profile_required" | "not_found" | "agency_trip" };

export async function requestJoin(
  userId: string,
  tripId: string,
  message: string | null,
): Promise<JoinResult> {
  const profile = await getJoinProfile(userId);
  if (!profile) return { ok: false, error: "profile_required" };
  return getDb().transaction(async (tx) => {
    const trip = await lockTripForJoin(tx, tripId);
    if (!trip) return { ok: false, error: "not_found" };
    if (trip.kind === "agency") return { ok: false, error: "agency_trip" }; // those take a request to the agency
    const [state, mine, blocked, n] = await Promise.all([
      getUserState(tx, userId),
      tx
        .select({ status: tripMembers.status })
        .from(tripMembers)
        .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId))),
      // Same connection as the row lock: a second pool connection here can deadlock the pool.
      trip.ownerUserId ? isBlockedBetween(userId, trip.ownerUserId, tx) : false,
      approvedCount(tx, tripId),
    ]);
    const denied = joinDenied(
      { ...trip, approvedCount: n },
      {
        id: userId,
        ...profile,
        phoneVerified: !!state?.phoneVerified,
        memberStatus: mine[0]?.status ?? null,
        blocked,
      },
    );
    if (denied) return { ok: false, error: denied };
    await tx
      .insert(tripMembers)
      .values({ tripId, userId, message })
      .onConflictDoUpdate({
        target: [tripMembers.tripId, tripMembers.userId],
        set: { status: "requested", message },
      });
    if (trip.ownerUserId) await notify(tx, trip.ownerUserId, "join_requested", { tripId, memberId: userId });
    return { ok: true };
  });
}

export type DecideResult = { ok: true } | { ok: false; error: "forbidden" | "not_pending" | "full" };

export async function decideRequest(
  organizerId: string,
  tripId: string,
  memberId: string,
  approve: boolean,
): Promise<DecideResult> {
  return getDb().transaction(async (tx) => {
    const trip = await lockTripForJoin(tx, tripId);
    if (!trip || trip.ownerUserId !== organizerId) return { ok: false, error: "forbidden" };
    const where = and(
      eq(tripMembers.tripId, tripId),
      eq(tripMembers.userId, memberId),
      eq(tripMembers.status, "requested"),
    );
    if (!approve) {
      const r = await tx.update(tripMembers).set({ status: "rejected" }).where(where).returning();
      if (!r.length) return { ok: false, error: "not_pending" };
      // A gentle note, no "rejected" word (product-decisions §1); blocked pairs never get here.
      await notify(tx, memberId, "join_rejected", { tripId });
      return { ok: true };
    }
    // A closed or hidden (moderated) trip takes no new members and must not come back as "full".
    if (trip.status !== "open" && trip.status !== "full") return { ok: false, error: "forbidden" };
    const n = await approvedCount(tx, tripId);
    if (trip.groupSizeMax != null && n >= trip.groupSizeMax) return { ok: false, error: "full" };
    const r = await tx.update(tripMembers).set({ status: "approved" }).where(where).returning();
    if (!r.length) return { ok: false, error: "not_pending" };
    await addTripChatMember(tx, tripId, memberId);
    await notify(tx, memberId, "join_approved", { tripId });
    if (trip.groupSizeMax != null && n + 1 >= trip.groupSizeMax) await setTripStatus(tx, tripId, "full");
    return { ok: true };
  });
}

/** Member leaves (or cancels a pending request). Organizers close the trip instead. */
export async function leaveTrip(userId: string, tripId: string) {
  await getDb().transaction(async (tx) => {
    const trip = await lockTripForJoin(tx, tripId);
    if (!trip || trip.ownerUserId === userId) return;
    const mine = and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId));
    const [before] = await tx.select({ status: tripMembers.status }).from(tripMembers).where(mine);
    if (before?.status !== "requested" && before?.status !== "approved") return;
    await tx.update(tripMembers).set({ status: "left" }).where(mine);
    if (before.status !== "approved") return; // a cancelled request frees no seat
    if (trip.ticketDeadline && trip.ticketDeadline < todayISO()) await recordNoShow(tx, userId, tripId);
    await removeTripChatMember(tx, tripId, userId);
    if (trip.status === "full") await setTripStatus(tx, tripId, "open");
  });
}

/**
 * After a block between an organizer and someone in (or asking to join) their trip: the member
 * leaves that group, so the two stop meeting in the room. Members who block each other stay —
 * their messages and notifications are already hidden from one another.
 */
export async function separateAfterBlock(a: string, b: string) {
  const shared = await getDb()
    .select({ tripId: trips.id, memberId: tripMembers.userId })
    .from(trips)
    .innerJoin(tripMembers, eq(tripMembers.tripId, trips.id))
    .where(
      and(
        inArray(tripMembers.status, ["requested", "approved"]),
        or(
          and(eq(trips.ownerUserId, a), eq(tripMembers.userId, b)),
          and(eq(trips.ownerUserId, b), eq(tripMembers.userId, a)),
        ),
      ),
    );
  for (const s of shared) {
    await getDb().transaction(async (tx) => {
      const trip = await lockTripForJoin(tx, s.tripId);
      if (!trip) return;
      const mine = and(eq(tripMembers.tripId, s.tripId), eq(tripMembers.userId, s.memberId));
      const [before] = await tx.select({ status: tripMembers.status }).from(tripMembers).where(mine);
      if (before?.status === "requested")
        await tx.update(tripMembers).set({ status: "rejected" }).where(mine);
      if (before?.status !== "approved") return;
      await tx.update(tripMembers).set({ status: "left" }).where(mine);
      await removeTripChatMember(tx, s.tripId, s.memberId);
      if (trip.status === "full") await setTripStatus(tx, s.tripId, "open");
    });
  }
}

/** Were these two people both approved members of at least one trip? (The condition for writing to each other.) */
export async function sharedApprovedTrip(a: string, b: string) {
  const rows = await getDb().execute<{ n: number }>(sql`
    select 1 as n from trip_members x join trip_members y on y.trip_id = x.trip_id
    where x.user_id = ${a} and y.user_id = ${b} and x.status = 'approved' and y.status = 'approved' limit 1`);
  return rows.length > 0;
}

/** Account deleted: free the person's seats and pending requests in other people's trips. */
export async function leaveAllTrips(tx: DbOrTx, userId: string) {
  const rows = await tx
    .update(tripMembers)
    .set({ status: "left" })
    .where(
      and(
        eq(tripMembers.userId, userId),
        eq(tripMembers.role, "member"),
        inArray(tripMembers.status, ["requested", "approved"]),
      ),
    )
    .returning({ tripId: tripMembers.tripId });
  for (const { tripId } of rows) await removeTripChatMember(tx, tripId, userId);
  if (rows.length)
    await tx
      .update(trips)
      .set({ status: "open" })
      .where(
        and(
          inArray(
            trips.id,
            rows.map((r) => r.tripId),
          ),
          eq(trips.status, "full"),
        ),
      );
}

/** Organizer view: pending requests + approved members with names. */
export async function listMembers(organizerOrMemberId: string, tripId: string) {
  const rows = await getDb()
    .select({
      userId: tripMembers.userId,
      status: tripMembers.status,
      role: tripMembers.role,
      message: tripMembers.message,
    })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), inArray(tripMembers.status, ["requested", "approved"])));
  // Only organizer and approved members see the list.
  const me = rows.find((r) => r.userId === organizerOrMemberId);
  if (!me || me.status !== "approved") return null;
  const isOrganizer = me.role === "organizer";
  const [names, rel] = await Promise.all([
    getDisplayNames(rows.map((r) => r.userId)),
    isOrganizer
      ? getReliability(rows.map((r) => r.userId))
      : new Map<string, { went: number; total: number }>(),
  ]);
  const noShows = (id: string) => {
    const x = rel.get(id);
    return x ? x.total - x.went : 0;
  };
  return rows
    .filter((r) => isOrganizer || r.status === "approved")
    .sort((a, b) => noShows(a.userId) - noShows(b.userId)) // people who didn't show up go lower
    .map((r) => ({
      ...r,
      name: names.get(r.userId) ?? "—",
      message: isOrganizer ? r.message : null,
      reliability: rel.get(r.userId) ?? null,
    }));
}
