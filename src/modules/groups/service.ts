import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { tripMembers } from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";
import { addTripChatMember, removeTripChatMember } from "@/modules/chat/service";
import { isBlockedBetween } from "@/modules/moderation/service";
import { getDisplayNames, getJoinProfile } from "@/modules/profiles/service";
import { lockTripForJoin, setTripStatus } from "@/modules/trips/service";
import { getUserState } from "@/modules/users/service";
import { type JoinDenied, joinDenied } from "./rules";

export async function addOrganizer(tx: DbOrTx, tripId: string, userId: string) {
  await tx.insert(tripMembers).values({ tripId, userId, role: "organizer", status: "approved" });
}

async function approvedCount(tx: DbOrTx, tripId: string) {
  const [r] = await tx
    .select({ n: count() })
    .from(tripMembers)
    .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.status, "approved")));
  return r.n;
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

export type JoinResult = { ok: true } | { ok: false; error: JoinDenied | "profile_required" | "not_found" };

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
    const [state, mine, blocked, n] = await Promise.all([
      getUserState(tx, userId),
      tx
        .select({ status: tripMembers.status })
        .from(tripMembers)
        .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId))),
      trip.ownerUserId ? isBlockedBetween(userId, trip.ownerUserId) : false,
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
      return r.length ? { ok: true } : { ok: false, error: "not_pending" };
    }
    const n = await approvedCount(tx, tripId);
    if (trip.groupSizeMax != null && n >= trip.groupSizeMax) return { ok: false, error: "full" };
    const r = await tx.update(tripMembers).set({ status: "approved" }).where(where).returning();
    if (!r.length) return { ok: false, error: "not_pending" };
    await addTripChatMember(tx, tripId, memberId);
    if (trip.groupSizeMax != null && n + 1 >= trip.groupSizeMax) await setTripStatus(tx, tripId, "full");
    return { ok: true };
  });
}

/** Member leaves (or cancels a pending request). Organizers close the trip instead. */
export async function leaveTrip(userId: string, tripId: string) {
  await getDb().transaction(async (tx) => {
    const trip = await lockTripForJoin(tx, tripId);
    if (!trip || trip.ownerUserId === userId) return;
    const r = await tx
      .update(tripMembers)
      .set({ status: "left" })
      .where(
        and(
          eq(tripMembers.tripId, tripId),
          eq(tripMembers.userId, userId),
          inArray(tripMembers.status, ["requested", "approved"]),
        ),
      )
      .returning({ was: tripMembers.status });
    if (!r.length) return;
    await removeTripChatMember(tx, tripId, userId);
    if (trip.status === "full") await setTripStatus(tx, tripId, "open");
  });
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
  const names = await getDisplayNames(rows.map((r) => r.userId));
  const isOrganizer = me.role === "organizer";
  return rows
    .filter((r) => isOrganizer || r.status === "approved")
    .map((r) => ({ ...r, name: names.get(r.userId) ?? "—", message: isOrganizer ? r.message : null }));
}
