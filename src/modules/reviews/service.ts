import "server-only";
import { and, avg, count, eq, inArray, isNull } from "drizzle-orm";
import { reviews } from "@/db/schema";
import { getDb } from "@/lib/db";
import { approvedMemberIds } from "@/modules/groups/service";
import { getBlockedIds } from "@/modules/moderation/service";
import { getDisplayNames } from "@/modules/profiles/service";
import { getTripView } from "@/modules/trips/service";

/** A rating is shown only from this many reviews on: one opinion is not a reputation. */
export const MIN_REVIEWS_SHOWN = 3;

/** userId → { avg, count } for people with enough reviews. */
export async function ratingsOf(userIds: string[]) {
  const out = new Map<string, { avg: number; count: number }>();
  if (!userIds.length) return out;
  const rows = await getDb()
    .select({ id: reviews.subjectUserId, avg: avg(reviews.rating), n: count() })
    .from(reviews)
    .where(and(inArray(reviews.subjectUserId, userIds), isNull(reviews.hiddenAt)))
    .groupBy(reviews.subjectUserId);
  for (const r of rows)
    if (r.id && r.n >= MIN_REVIEWS_SHOWN)
      out.set(r.id, { avg: Math.round(Number(r.avg) * 10) / 10, count: r.n });
  return out;
}

/** Who I can rate on a finished trip: the people who were there, not blocked either way. */
export async function reviewable(userId: string, tripId: string) {
  const trip = await getTripView(tripId, userId);
  if (!trip || trip.status !== "completed") return null;
  const others = await approvedMemberIds(getDb(), tripId, userId);
  const all = await approvedMemberIds(getDb(), tripId, "");
  if (!all.includes(userId)) return null; // only people who were in the group
  const blocked = new Set(await getBlockedIds(userId));
  const people = others.filter((id) => !blocked.has(id));
  const [names, mine] = await Promise.all([
    getDisplayNames(people),
    getDb()
      .select({ subject: reviews.subjectUserId, rating: reviews.rating })
      .from(reviews)
      .where(and(eq(reviews.tripId, tripId), eq(reviews.authorId, userId))),
  ]);
  const given = new Map(mine.map((m) => [m.subject, m.rating]));
  return {
    title: trip.title,
    people: people
      .filter((id) => names.has(id))
      .map((id) => ({ id, name: names.get(id)!, rating: given.get(id) ?? null })),
  };
}

export type ReviewResult = { ok: true } | { ok: false; error: "forbidden" | "not_found" };

/** Rate one companion of a finished trip (1–5, optional words). Rating again replaces the first. */
export async function submitReview(
  userId: string,
  tripId: string,
  subjectId: string,
  rating: number,
  body: string | null,
): Promise<ReviewResult> {
  const r = await reviewable(userId, tripId);
  if (!r) return { ok: false, error: "not_found" };
  if (!r.people.some((p) => p.id === subjectId)) return { ok: false, error: "forbidden" };
  await getDb()
    .insert(reviews)
    .values({ tripId, authorId: userId, subjectUserId: subjectId, rating, body })
    .onConflictDoUpdate({
      target: [reviews.tripId, reviews.authorId, reviews.subjectUserId],
      set: { rating, body, updatedAt: new Date() },
    });
  return { ok: true };
}
