import { eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { creatorEntries, tripMembers, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getMyEntries, joinCreator, openOffers, submitReel } from "./service";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];
const day = (offset: number) =>
  new Date(Date.now() + offset * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });

afterAll(async () => {
  if (!run) return;
  await getDb().delete(trips).where(inArray(trips.ownerUserId, made));
  await getDb().delete(users).where(inArray(users.id, made));
});

it.runIf(run)("1M Safar: open during/after the trip, once a year, reel link", async () => {
  const db = getDb();
  const [org, me] = await Promise.all(
    [0, 1].map(
      async () => (await db.insert(users).values({ locale: "uz" }).returning({ id: users.id }))[0].id,
    ),
  );
  made.push(org, me);
  const trip = async (startDate: string, endDate: string) => {
    const [t] = await db
      .insert(trips)
      .values({
        kind: "independent",
        ownerUserId: org,
        title: "TEST 1m",
        destinationCountry: "GE",
        startDate,
        endDate,
        status: "open",
        groupSizeMax: 4,
        isTest: true,
      })
      .returning({ id: trips.id });
    await db.insert(tripMembers).values({ tripId: t.id, userId: me, status: "approved" });
    return t.id;
  };
  const running = await trip(day(-1), day(4));
  const future = await trip(day(10), day(15));
  const longAgo = await trip(day(-60), day(-40));

  expect((await openOffers(me)).map((o) => o.id)).toEqual([running]);
  expect(await joinCreator(me, future)).toBe("closed"); // not started
  expect(await joinCreator(me, longAgo)).toBe("closed"); // posting window over
  expect(await joinCreator(org, running)).toBe("closed"); // org is not an approved member here
  expect(await joinCreator(me, running)).toBe("ok");
  expect(await joinCreator(me, running)).toBe("ok"); // re-tap is a no-op

  const [e] = await getMyEntries(me);
  expect(e).toMatchObject({ tripId: running, status: "joined" });
  expect(await submitReel(org, e.id, "@x", "https://instagram.com/reel/abc")).toBe(false); // not theirs
  expect(await submitReel(me, e.id, "@me", "https://instagram.com/reel/abc")).toBe(true);
  const [after] = await getMyEntries(me);
  expect(after).toMatchObject({ status: "tracking", instagram: "@me", postedAt: day(0) });

  // Once a year: another running trip is refused.
  const second = await trip(day(-2), day(3));
  expect(await joinCreator(me, second)).toBe("yearly");
  expect(await db.select().from(creatorEntries).where(eq(creatorEntries.userId, me))).toHaveLength(1);
});
