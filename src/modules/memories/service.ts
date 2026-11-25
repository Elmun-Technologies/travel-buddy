import "server-only";
import { and, count, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { tripPhotos, tripStories, trips } from "@/db/schema";
import { todayISO } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { approvedMemberIds, getMemberships, setStoryConsent, storyConsent } from "@/modules/groups/service";
import { getBlockedIds } from "@/modules/moderation/service";
import { getDisplayNames } from "@/modules/profiles/service";
import { isActiveUser } from "@/modules/users/service";

export const MAX_PHOTOS_PER_PERSON = 40;

/** The album of a trip opens when it starts. Only people who were in the group see or add to it. */
export async function albumAccess(userId: string, tripId: string) {
  const [t] = await getDb()
    .select({
      id: trips.id,
      title: trips.title,
      status: trips.status,
      start: trips.startDate,
      owner: trips.ownerUserId,
    })
    .from(trips)
    .where(eq(trips.id, tripId));
  if (!t || t.status === "hidden" || t.status === "draft") return null;
  if (t.status !== "completed" && t.start > todayISO()) return null;
  if (!(await approvedMemberIds(getDb(), tripId, "")).includes(userId)) return null;
  if (!(await isActiveUser(userId))) return null;
  return t;
}

export async function listAlbum(userId: string, tripId: string) {
  const blocked = await getBlockedIds(userId);
  const [photos, stories] = await Promise.all([
    getDb()
      .select({
        id: tripPhotos.id,
        userId: tripPhotos.userId,
        caption: tripPhotos.caption,
        at: tripPhotos.createdAt,
      })
      .from(tripPhotos)
      .where(and(eq(tripPhotos.tripId, tripId), isNull(tripPhotos.hiddenAt)))
      .orderBy(desc(tripPhotos.createdAt))
      .limit(200),
    getDb()
      .select({ userId: tripStories.userId, body: tripStories.body })
      .from(tripStories)
      .where(eq(tripStories.tripId, tripId))
      .orderBy(desc(tripStories.createdAt)),
  ]);
  const visible = (id: string) => !blocked.includes(id);
  const names = await getDisplayNames([
    ...new Set([...photos.map((p) => p.userId), ...stories.map((s) => s.userId)]),
  ]);
  return {
    photos: photos.filter((p) => visible(p.userId)).map((p) => ({ ...p, name: names.get(p.userId) ?? "—" })),
    stories: stories
      .filter((s) => visible(s.userId))
      .map((s) => ({ ...s, name: names.get(s.userId) ?? "—" })),
  };
}

export async function photoCount(userId: string, tripId: string) {
  const [r] = await getDb()
    .select({ n: count() })
    .from(tripPhotos)
    .where(and(eq(tripPhotos.tripId, tripId), eq(tripPhotos.userId, userId)));
  return r.n;
}

export async function addPhoto(userId: string, tripId: string, key: string, caption: string | null) {
  const [p] = await getDb()
    .insert(tripPhotos)
    .values({ tripId, userId, key, caption })
    .returning({ id: tripPhotos.id });
  return p.id;
}

/** Remove a photo: its author, or the organizer of the trip. Returns the storage key to delete. */
export async function removePhoto(userId: string, tripId: string, photoId: string) {
  const [row] = await getDb()
    .select({ key: tripPhotos.key, author: tripPhotos.userId, owner: trips.ownerUserId })
    .from(tripPhotos)
    .innerJoin(trips, eq(trips.id, tripPhotos.tripId))
    .where(and(eq(tripPhotos.id, photoId), eq(tripPhotos.tripId, tripId)));
  if (!row || (row.author !== userId && row.owner !== userId)) return null;
  await getDb().delete(tripPhotos).where(eq(tripPhotos.id, photoId));
  return row.key;
}

/** A photo's storage key, if this person is in that trip's group and not blocked from the author. */
export async function photoKeyFor(viewerId: string, photoId: string) {
  const [p] = await getDb()
    .select({ key: tripPhotos.key, tripId: tripPhotos.tripId, author: tripPhotos.userId })
    .from(tripPhotos)
    .where(and(eq(tripPhotos.id, photoId), isNull(tripPhotos.hiddenAt)));
  if (!p) return null;
  if (!(await albumAccess(viewerId, p.tripId))) return null;
  if (p.author !== viewerId && (await getBlockedIds(viewerId)).includes(p.author)) return null;
  return p.key;
}

/** Hide a photo from the album (moderation); the file stays until the account is erased. */
export async function hidePhoto(photoId: string) {
  await getDb().update(tripPhotos).set({ hiddenAt: new Date() }).where(eq(tripPhotos.id, photoId));
}

export async function setConsent(userId: string, tripId: string, on: boolean) {
  const access = await albumAccess(userId, tripId);
  if (!access || access.status !== "completed") return false; // only finished trips can go public
  return setStoryConsent(userId, tripId, on);
}

/** Album panel data: my choice, the group's count, and the public link once everybody agreed. */
export async function consentState(userId: string, tripId: string) {
  const [c, [t]] = await Promise.all([
    storyConsent(tripId, userId),
    getDb().select({ code: trips.publicCode, status: trips.status }).from(trips).where(eq(trips.id, tripId)),
  ]);
  return {
    finished: t?.status === "completed",
    total: c.total,
    agreed: c.agreed,
    mine: c.mine,
    code: c.everyone && t?.status === "completed" ? t.code : null,
  };
}

/**
 * The public "hikoya" page: a finished trip whose approved members ALL agreed (at least two).
 * Anyone who withdraws takes the whole page offline. No contact data, only names, photos and stories.
 */
export async function publicStory(code: string) {
  if (!/^[0-9A-Z]{6,8}$/.test(code)) return null;
  const [t] = await getDb()
    .select({
      id: trips.id,
      title: trips.title,
      country: trips.destinationCountry,
      city: trips.destinationCity,
      start: trips.startDate,
      end: trips.endDate,
      status: trips.status,
      kind: trips.kind,
    })
    .from(trips)
    .where(eq(trips.publicCode, code));
  if (!t || t.status !== "completed" || t.kind !== "independent") return null;
  const c = await storyConsent(t.id, null);
  if (!c.everyone) return null;
  const [photos, stories] = await Promise.all([
    getDb()
      .select({ id: tripPhotos.id, caption: tripPhotos.caption })
      .from(tripPhotos)
      .where(and(eq(tripPhotos.tripId, t.id), isNull(tripPhotos.hiddenAt)))
      .orderBy(desc(tripPhotos.createdAt))
      .limit(24),
    getDb()
      .select({ userId: tripStories.userId, body: tripStories.body })
      .from(tripStories)
      .where(eq(tripStories.tripId, t.id)),
  ]);
  const names = await getDisplayNames(c.names);
  return {
    ...t,
    people: c.names.map((id) => names.get(id)).filter((n): n is string => !!n),
    photos,
    stories: stories.flatMap((s) =>
      names.get(s.userId) ? [{ name: names.get(s.userId)!, body: s.body }] : [],
    ),
  };
}

/** A photo of a trip whose story is public (no login needed). */
export async function publicPhotoKey(photoId: string) {
  const [p] = await getDb()
    .select({ key: tripPhotos.key, tripId: tripPhotos.tripId })
    .from(tripPhotos)
    .where(and(eq(tripPhotos.id, photoId), isNull(tripPhotos.hiddenAt)));
  if (!p) return null;
  const [t] = await getDb().select({ code: trips.publicCode }).from(trips).where(eq(trips.id, p.tripId));
  return t?.code && (await publicStory(t.code)) ? p.key : null;
}

export async function saveStory(userId: string, tripId: string, body: string) {
  await getDb()
    .insert(tripStories)
    .values({ tripId, userId, body })
    .onConflictDoUpdate({
      target: [tripStories.tripId, tripStories.userId],
      set: { body, updatedAt: new Date() },
    });
}

export async function myStory(userId: string, tripId: string) {
  const [s] = await getDb()
    .select({ body: tripStories.body })
    .from(tripStories)
    .where(and(eq(tripStories.tripId, tripId), eq(tripStories.userId, userId)));
  return s?.body ?? "";
}

/** "Taassurotlar": my trips that have started, with how many photos each has. */
export async function listMyMemories(userId: string) {
  const mine = [...(await getMemberships(userId)).entries()]
    .filter(([, m]) => m.status === "approved")
    .map(([id]) => id);
  if (!mine.length) return [];
  const rows = await getDb()
    .select({
      id: trips.id,
      title: trips.title,
      start: trips.startDate,
      end: trips.endDate,
      status: trips.status,
      country: trips.destinationCountry,
    })
    .from(trips)
    .where(and(inArray(trips.id, mine), or(eq(trips.status, "completed"), lte(trips.startDate, todayISO()))))
    .orderBy(desc(trips.startDate));
  if (!rows.length) return [];
  const counts = await getDb()
    .select({ tripId: tripPhotos.tripId, n: count() })
    .from(tripPhotos)
    .where(
      and(
        inArray(
          tripPhotos.tripId,
          rows.map((r) => r.id),
        ),
        isNull(tripPhotos.hiddenAt),
      ),
    )
    .groupBy(tripPhotos.tripId);
  const n = new Map(counts.map((c) => [c.tripId, c.n]));
  return rows.map((r) => ({ ...r, photos: n.get(r.id) ?? 0 }));
}
