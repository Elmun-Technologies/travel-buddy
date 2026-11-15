import { and, eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { notifications, tripMembers, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { queueCreatorInvites } from "./creator";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];
const day = (offset: number) =>
  new Date(Date.now() + offset * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
const tashkentHour = Number(
  new Date().toLocaleString("en-GB", { timeZone: "Asia/Tashkent", hour: "2-digit", hour12: false }),
);

afterAll(async () => {
  if (!run) return;
  await getDb().delete(trips).where(inArray(trips.ownerUserId, made));
  await getDb().delete(users).where(inArray(users.id, made));
});

it.runIf(run)("1M Safar invite: day 2 from 09:00, once per trip", async () => {
  const db = getDb();
  const [me] = await db.insert(users).values({ locale: "uz" }).returning({ id: users.id });
  made.push(me.id);
  const trip = async (start: number) => {
    const [t] = await db
      .insert(trips)
      .values({
        kind: "independent",
        ownerUserId: me.id,
        title: "TEST 1m invite",
        destinationCountry: "GE",
        startDate: day(start),
        endDate: day(start + 5),
        status: "open",
        groupSizeMax: 4,
        isTest: true,
        createdAt: new Date(Date.now() - 20 * 864e5), // set up before departure
      })
      .returning({ id: trips.id });
    await db
      .insert(tripMembers)
      .values({ tripId: t.id, userId: me.id, role: "organizer", status: "approved" });
    return t.id;
  };
  const day2 = await trip(-1);
  await trip(0); // day 1: not yet
  await queueCreatorInvites(db);
  await queueCreatorInvites(db);
  const sent = await db
    .select({ tripId: notifications.payload })
    .from(notifications)
    .where(and(eq(notifications.userId, me.id), eq(notifications.type, "creator_invite")));
  expect(sent).toEqual(tashkentHour >= 9 ? [{ tripId: { tripId: day2 } }] : []);
});
