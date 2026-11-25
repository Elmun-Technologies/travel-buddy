import "server-only";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { clubMembers, clubPosts, clubs, reviews, trips } from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";
import { getBlockedIds } from "@/modules/moderation/service";
import { notify } from "@/modules/notifications/service";
import { getDisplayNames } from "@/modules/profiles/service";
import { MIN_REVIEWS_SHOWN } from "@/modules/reviews/service";
import { getUserState } from "@/modules/users/service";

export const MAX_CLUBS_OWNED = 3;

export type ClubInput = {
  name: string;
  description: string | null;
  rules: string | null;
  city: string | null;
  privacy: "open" | "closed";
};

const slugOf = (name: string) =>
  `${
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "club"
  }-${crypto.randomUUID().slice(0, 6)}`;

export type CreateClubResult = { ok: true; id: string } | { ok: false; error: "phone_required" | "too_many" };

/** Any traveler with a verified phone may open a club (plan v2 stage 6); at most 3 each. */
export async function createClub(userId: string, input: ClubInput): Promise<CreateClubResult> {
  const state = await getUserState(getDb(), userId);
  if (!state?.phoneVerified) return { ok: false, error: "phone_required" };
  return getDb().transaction(async (tx) => {
    const [owned] = await tx
      .select({ n: count() })
      .from(clubs)
      .where(and(eq(clubs.ownerUserId, userId), eq(clubs.status, "active")));
    if (owned.n >= MAX_CLUBS_OWNED) return { ok: false, error: "too_many" };
    const [c] = await tx
      .insert(clubs)
      .values({ ...input, slug: slugOf(input.name), ownerUserId: userId })
      .returning({ id: clubs.id });
    await tx.insert(clubMembers).values({ clubId: c.id, userId, role: "organizer", status: "approved" });
    return { ok: true, id: c.id };
  });
}

/**
 * What people who went on a club's finished trips gave each other (visible reviews only).
 * A number is returned only from MIN_REVIEWS_SHOWN reviews on; before that the club shows trips taken, no score.
 */
export async function clubRatings(clubIds: string[]) {
  const out = new Map<string, { avg: number; count: number }>();
  if (!clubIds.length) return out;
  const rows = await getDb()
    .select({ id: trips.clubId, avg: sql<string>`avg(${reviews.rating})`, n: count() })
    .from(reviews)
    .innerJoin(trips, eq(trips.id, reviews.tripId))
    .where(and(inArray(trips.clubId, clubIds), eq(trips.status, "completed"), isNull(reviews.hiddenAt)))
    .groupBy(trips.clubId);
  for (const r of rows)
    if (r.id && r.n >= MIN_REVIEWS_SHOWN)
      out.set(r.id, { avg: Math.round(Number(r.avg) * 10) / 10, count: r.n });
  return out;
}

/** Active clubs with member counts; clubs of people you blocked (or who blocked you) are not shown. */
export async function listClubs(viewerId: string, q = "") {
  const blocked = await getBlockedIds(viewerId);
  const term = `%${q.trim().replace(/[%_]/g, "")}%`;
  const rows = await getDb()
    .select({
      id: clubs.id,
      name: clubs.name,
      description: clubs.description,
      city: clubs.city,
      privacy: clubs.privacy,
      owner: clubs.ownerUserId,
      members: sql<number>`(select count(*)::int from club_members m where m.club_id = clubs.id and m.status = 'approved')`,
      completed: sql<number>`(select count(*)::int from trips t where t.club_id = clubs.id and t.status = 'completed')`,
    })
    .from(clubs)
    .where(and(eq(clubs.status, "active"), q.trim() ? sql`${clubs.name} ilike ${term}` : undefined))
    .orderBy(
      desc(sql`(select count(*) from club_members m where m.club_id = clubs.id and m.status = 'approved')`),
      desc(clubs.createdAt),
    )
    .limit(60);
  const mine = await getDb()
    .select({ clubId: clubMembers.clubId, status: clubMembers.status })
    .from(clubMembers)
    .where(eq(clubMembers.userId, viewerId));
  const m = new Map(mine.map((x) => [x.clubId, x.status]));
  const ratings = await clubRatings(rows.map((r) => r.id));
  return rows
    .filter((r) => !r.owner || !blocked.includes(r.owner))
    .map((r) => ({ ...r, myStatus: m.get(r.id) ?? null, rating: ratings.get(r.id) ?? null }));
}

export async function myClubIds(userId: string) {
  const rows = await getDb()
    .select({ id: clubMembers.clubId })
    .from(clubMembers)
    .where(and(eq(clubMembers.userId, userId), eq(clubMembers.status, "approved")));
  return rows.map((r) => r.id);
}

/** Club page data. Null if hidden or if the owner is blocked from the viewer. */
export async function getClub(viewerId: string, clubId: string) {
  const [c] = await getDb().select().from(clubs).where(eq(clubs.id, clubId));
  if (!c || c.status !== "active") return null;
  const blocked = await getBlockedIds(viewerId);
  if (c.ownerUserId && blocked.includes(c.ownerUserId)) return null;
  const members = await getDb()
    .select({ userId: clubMembers.userId, role: clubMembers.role, status: clubMembers.status })
    .from(clubMembers)
    .where(and(eq(clubMembers.clubId, clubId), inArray(clubMembers.status, ["approved", "requested"])));
  const me = members.find((m) => m.userId === viewerId);
  const isMember = me?.status === "approved";
  const isOrganizer = isMember && me?.role === "organizer";
  const approved = members.filter((m) => m.status === "approved");
  const visibleMembers = isMember ? approved.filter((m) => !blocked.includes(m.userId)) : [];
  const requests = isOrganizer ? members.filter((m) => m.status === "requested") : [];
  const names = await getDisplayNames([...visibleMembers, ...requests].map((m) => m.userId));
  const canSeePosts = c.privacy === "open" || isMember;
  const posts = canSeePosts
    ? await getDb()
        .select({ id: clubPosts.id, userId: clubPosts.userId, body: clubPosts.body, at: clubPosts.createdAt })
        .from(clubPosts)
        .where(and(eq(clubPosts.clubId, clubId), isNull(clubPosts.hiddenAt)))
        .orderBy(desc(clubPosts.createdAt))
        .limit(30)
    : [];
  const postNames = await getDisplayNames([...new Set(posts.flatMap((p) => (p.userId ? [p.userId] : [])))]);
  const clubTrips = await getDb()
    .select({
      id: trips.id,
      title: trips.title,
      start: trips.startDate,
      end: trips.endDate,
      status: trips.status,
      max: trips.groupSizeMax,
    })
    .from(trips)
    .where(and(eq(trips.clubId, clubId), inArray(trips.status, ["open", "full", "completed"])))
    .orderBy(desc(trips.startDate))
    .limit(20);
  return {
    ...c,
    myStatus: me?.status ?? null,
    isMember,
    isOrganizer,
    memberCount: approved.length,
    completedTrips: clubTrips.filter((t) => t.status === "completed").length,
    rating: (await clubRatings([clubId])).get(clubId) ?? null,
    members: visibleMembers.map((m) => ({ ...m, name: names.get(m.userId) ?? "—" })),
    requests: requests.map((m) => ({ userId: m.userId, name: names.get(m.userId) ?? "—" })),
    posts: posts
      .filter((p) => !p.userId || !blocked.includes(p.userId))
      .map((p) => ({ ...p, name: (p.userId && postNames.get(p.userId)) || "—", at: p.at.toISOString() })),
    trips: clubTrips,
  };
}

export type ClubResult =
  { ok: true } | { ok: false; error: "not_found" | "forbidden" | "blocked" | "already" };

export async function joinClub(userId: string, clubId: string): Promise<ClubResult> {
  const [c] = await getDb()
    .select()
    .from(clubs)
    .where(and(eq(clubs.id, clubId), eq(clubs.status, "active")));
  if (!c) return { ok: false, error: "not_found" };
  if (c.ownerUserId && (await getBlockedIds(userId)).includes(c.ownerUserId))
    return { ok: false, error: "blocked" };
  return getDb().transaction(async (tx) => {
    const [mine] = await tx
      .select()
      .from(clubMembers)
      .where(and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId)));
    if (mine && (mine.status === "approved" || mine.status === "requested"))
      return { ok: false, error: "already" };
    const status = c.privacy === "open" ? "approved" : "requested";
    await tx
      .insert(clubMembers)
      .values({ clubId, userId, status })
      .onConflictDoUpdate({ target: [clubMembers.clubId, clubMembers.userId], set: { status } });
    if (status === "requested" && c.ownerUserId)
      await notify(tx, c.ownerUserId, "club_requested", { clubId, memberId: userId, text: c.name });
    return { ok: true };
  });
}

export async function leaveClub(userId: string, clubId: string): Promise<ClubResult> {
  const r = await getDb()
    .update(clubMembers)
    .set({ status: "left" })
    .where(
      and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.userId, userId),
        eq(clubMembers.role, "member"), // an organizer closes the club instead
        inArray(clubMembers.status, ["approved", "requested"]),
      ),
    )
    .returning({ id: clubMembers.id });
  return r.length ? { ok: true } : { ok: false, error: "forbidden" };
}

export async function decideClubRequest(
  organizerId: string,
  clubId: string,
  memberId: string,
  approve: boolean,
): Promise<ClubResult> {
  return getDb().transaction(async (tx) => {
    const [org] = await tx
      .select({ id: clubMembers.id })
      .from(clubMembers)
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.userId, organizerId),
          eq(clubMembers.role, "organizer"),
          eq(clubMembers.status, "approved"),
        ),
      );
    if (!org) return { ok: false, error: "forbidden" };
    const r = await tx
      .update(clubMembers)
      .set({ status: approve ? "approved" : "rejected" })
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.userId, memberId),
          eq(clubMembers.status, "requested"),
        ),
      )
      .returning({ id: clubMembers.id });
    if (!r.length) return { ok: false, error: "not_found" };
    if (approve) {
      const [c] = await tx.select({ name: clubs.name }).from(clubs).where(eq(clubs.id, clubId));
      await notify(tx, memberId, "club_approved", { clubId, text: c?.name ?? "" });
    }
    return { ok: true };
  });
}

export async function addPost(userId: string, clubId: string, body: string): Promise<ClubResult> {
  const [m] = await getDb()
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .where(
      and(eq(clubMembers.clubId, clubId), eq(clubMembers.userId, userId), eq(clubMembers.status, "approved")),
    );
  if (!m) return { ok: false, error: "forbidden" };
  await getDb().insert(clubPosts).values({ clubId, userId, body });
  return { ok: true };
}

/** A post is removed by its author or by a club organizer. */
export async function removePost(userId: string, clubId: string, postId: string): Promise<ClubResult> {
  const [p] = await getDb()
    .select({ author: clubPosts.userId })
    .from(clubPosts)
    .where(and(eq(clubPosts.id, postId), eq(clubPosts.clubId, clubId)));
  if (!p) return { ok: false, error: "not_found" };
  if (p.author !== userId) {
    const [org] = await getDb()
      .select({ id: clubMembers.id })
      .from(clubMembers)
      .where(
        and(
          eq(clubMembers.clubId, clubId),
          eq(clubMembers.userId, userId),
          eq(clubMembers.role, "organizer"),
          eq(clubMembers.status, "approved"),
        ),
      );
    if (!org) return { ok: false, error: "forbidden" };
  }
  await getDb().delete(clubPosts).where(eq(clubPosts.id, postId));
  return { ok: true };
}

/** May this person open a trip in the club's name? Organizers only. */
export async function isClubOrganizer(userId: string, clubId: string) {
  const [org] = await getDb()
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .where(
      and(
        eq(clubMembers.clubId, clubId),
        eq(clubMembers.userId, userId),
        eq(clubMembers.role, "organizer"),
        eq(clubMembers.status, "approved"),
      ),
    );
  return !!org;
}

export async function clubName(clubId: string) {
  const [c] = await getDb()
    .select({ name: clubs.name, status: clubs.status })
    .from(clubs)
    .where(eq(clubs.id, clubId));
  return c && c.status === "active" ? c.name : null;
}

/** Moderation: hide or restore a club (admin). */
export async function setClubStatus(clubId: string, status: "active" | "hidden", db: DbOrTx = getDb()) {
  const r = await db.update(clubs).set({ status }).where(eq(clubs.id, clubId)).returning({ id: clubs.id });
  return r.length > 0;
}

export async function listAllClubsForAdmin() {
  return getDb()
    .select({
      id: clubs.id,
      name: clubs.name,
      status: clubs.status,
      privacy: clubs.privacy,
      createdAt: clubs.createdAt,
    })
    .from(clubs)
    .orderBy(desc(clubs.createdAt))
    .limit(100);
}
