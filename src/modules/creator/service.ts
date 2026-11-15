import "server-only";
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { creatorEntries, trips } from "@/db/schema";
import { getDb } from "@/lib/db";
import { isApprovedMember } from "@/modules/safety/service";

// "1M Safar" (product-decisions §8): a hidden offer that reaches people only during a trip.
// One threshold: 1 000 000 organic views → documented costs refunded up to $1 000. No partial pay.
export const GOAL_VIEWS = 1_000_000;
export const REFUND_USD = 1_000;
export const POST_DAYS = 30; // post within 30 days after the trip
export const COUNT_DAYS = 30; // views counted 30 days after posting

/** Off unless CREATOR_ENABLED=1: pages 404, the bot sends no invite. */
export const creatorEnabled = () => process.env.CREATOR_ENABLED === "1";

const today = sql`(now() at time zone 'Asia/Tashkent')::date`;

export type CreatorEntry = Awaited<ReturnType<typeof getMyEntries>>[number];

export async function getMyEntries(userId: string) {
  return getDb()
    .select({
      id: creatorEntries.id,
      tripId: creatorEntries.tripId,
      status: creatorEntries.status,
      instagram: creatorEntries.instagram,
      reelUrl: creatorEntries.reelUrl,
      postedAt: creatorEntries.postedAt,
      views: creatorEntries.views,
      viewsAt: creatorEntries.viewsAt,
      note: creatorEntries.note,
      title: trips.title,
      country: trips.destinationCountry,
      endDate: trips.endDate,
      today: sql<string>`${today}::text`,
    })
    .from(creatorEntries)
    .innerJoin(trips, eq(trips.id, creatorEntries.tripId))
    .where(eq(creatorEntries.userId, userId))
    .orderBy(desc(creatorEntries.createdAt));
}

/** The offer is open from the trip's first day until 30 days after it ends, for approved members. */
export async function offerFor(userId: string, tripId: string) {
  if (!(await isApprovedMember(userId, tripId))) return null;
  const [t] = await getDb()
    .select({
      id: trips.id,
      title: trips.title,
      country: trips.destinationCountry,
      open: sql<boolean>`${trips.startDate} <= ${today} and ${trips.endDate} + ${POST_DAYS}::int >= ${today}`,
    })
    .from(trips)
    .where(eq(trips.id, tripId));
  return t?.open ? t : null;
}

/** "Qatnashaman". Once a year per person (a re-tap on the same trip is a no-op). */
export async function joinCreator(userId: string, tripId: string) {
  if (!(await offerFor(userId, tripId))) return "closed" as const;
  const db = getDb();
  const [other] = await db
    .select({ id: creatorEntries.id })
    .from(creatorEntries)
    .where(
      and(
        eq(creatorEntries.userId, userId),
        ne(creatorEntries.tripId, tripId),
        gt(creatorEntries.createdAt, sql`now() - interval '1 year'`),
      ),
    );
  if (other) return "yearly" as const;
  await db.insert(creatorEntries).values({ userId, tripId }).onConflictDoNothing();
  return "ok" as const;
}

/** The Reel link and @handle. Views are then read by admin (later: Instagram API). */
export async function submitReel(userId: string, entryId: string, instagram: string, reelUrl: string) {
  const r = await getDb()
    .update(creatorEntries)
    .set({
      instagram,
      reelUrl,
      postedAt: sql`coalesce(${creatorEntries.postedAt}, ${today})`, // a fix of the link keeps the window
      status: "tracking",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(creatorEntries.id, entryId),
        eq(creatorEntries.userId, userId),
        sql`${creatorEntries.status} in ('joined', 'tracking')`,
        sql`exists (select 1 from trips t where t.id = ${creatorEntries.tripId}
          and t.end_date + ${POST_DAYS}::int >= ${today})`,
      ),
    )
    .returning({ id: creatorEntries.id });
  return r.length > 0;
}

/** The account people tag ("@travelbuddy"). INSTAGRAM_HANDLE once the brand account exists. */
export const igHandle = () =>
  process.env.INSTAGRAM_HANDLE ||
  `@${(process.env.APP_NAME || "Travel Buddy").toLowerCase().replace(/[^a-z0-9._]/g, "")}`;

/** Trips where the offer is open for this person and they haven't joined yet (track page, empty state). */
export async function openOffers(userId: string) {
  const rows = await getDb().execute<{ id: string; title: string; country: string }>(sql`
    select t.id, t.title, t.destination_country as country from trips t
    join trip_members tm on tm.trip_id = t.id and tm.user_id = ${userId} and tm.status = 'approved'
    where t.start_date <= ${today} and t.end_date + ${POST_DAYS}::int >= ${today}
      and not exists (select 1 from creator_entries c where c.trip_id = t.id and c.user_id = ${userId})
    order by t.start_date desc limit 3`);
  return [...rows];
}
