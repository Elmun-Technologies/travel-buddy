import { and, eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import {
  conversationMembers,
  conversations,
  notifications,
  reliability,
  tripMembers,
  tripTickets,
  trips,
  users,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { getReliability } from "@/modules/reliability/service";
import { runReliability } from "./reliability";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];
const day = (offset: number) =>
  new Date(Date.now() + offset * 864e5).toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });

afterAll(async () => {
  if (!run) return;
  await getDb().delete(trips).where(inArray(trips.ownerUserId, made));
  await getDb().delete(users).where(inArray(users.id, made));
});

it.runIf(run)("deadline frees unticketed places; finished trips count as went", async () => {
  const db = getDb();
  const [org, ticketed, late, waiting, newcomer] = await Promise.all(
    [0, 1, 2, 3, 4].map(
      async () => (await db.insert(users).values({ locale: "uz" }).returning({ id: users.id }))[0].id,
    ),
  );
  made.push(org, ticketed, late, waiting, newcomer);
  const trip = async (v: Partial<typeof trips.$inferInsert>) =>
    (
      await db
        .insert(trips)
        .values({
          kind: "independent",
          ownerUserId: org,
          title: "TEST rel",
          destinationCountry: "GE",
          startDate: day(10),
          endDate: day(15),
          status: "full",
          groupSizeMax: 3,
          isTest: true,
          ...v,
        })
        .returning({ id: trips.id })
    )[0].id;

  // Deadline yesterday: "late" has no ticket → place freed, no_show, out of the chat, trip reopens.
  const t1 = await trip({ ticketDeadline: day(-1) });
  await db.insert(tripMembers).values([
    { tripId: t1, userId: org, role: "organizer", status: "approved" },
    { tripId: t1, userId: ticketed, status: "approved", updatedAt: new Date(Date.now() - 3 * 864e5) },
    { tripId: t1, userId: late, status: "approved", updatedAt: new Date(Date.now() - 3 * 864e5) },
    { tripId: t1, userId: waiting, status: "requested" },
    // approved just now, after the deadline passed: not punished for missing it
    { tripId: t1, userId: newcomer, status: "approved" },
  ]);
  await db.insert(tripTickets).values({ tripId: t1, userId: ticketed });
  const [c] = await db.insert(conversations).values({ kind: "trip_group", tripId: t1 }).returning();
  await db
    .insert(conversationMembers)
    .values([org, ticketed, late].map((userId) => ({ conversationId: c.id, userId })));

  // Ended yesterday: everyone still approved went.
  const t2 = await trip({ startDate: day(-5), endDate: day(-1), status: "open" });
  await db.insert(tripMembers).values([
    { tripId: t2, userId: org, role: "organizer", status: "approved" },
    { tripId: t2, userId: late, status: "approved" },
  ]);

  // Deadline in 2 days: reminder once.
  const t3 = await trip({ ticketDeadline: day(2), status: "open" });
  await db.insert(tripMembers).values({ tripId: t3, userId: waiting, status: "approved" });

  await runReliability(db);
  await runReliability(db); // idempotent

  const status = async (tripId: string, userId: string) =>
    (
      await db
        .select({ s: tripMembers.status })
        .from(tripMembers)
        .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)))
    )[0].s;
  expect(await status(t1, late)).toBe("left");
  expect(await status(t1, ticketed)).toBe("approved");
  expect(await status(t1, newcomer)).toBe("approved");
  expect((await db.select({ s: trips.status }).from(trips).where(eq(trips.id, t1)))[0].s).toBe("open");
  const chat = await db
    .select({ leftAt: conversationMembers.leftAt })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.conversationId, c.id), eq(conversationMembers.userId, late)));
  expect(chat[0].leftAt).not.toBeNull();
  expect((await db.select({ s: trips.status }).from(trips).where(eq(trips.id, t2)))[0].s).toBe("completed");

  const rel = await getReliability([late, org, ticketed]);
  expect(rel.get(late)).toEqual({ went: 1, total: 2 }); // went t2, no-show on t1
  expect(rel.get(org)).toEqual({ went: 1, total: 1 });
  expect(rel.has(ticketed)).toBe(false); // t1 not finished yet

  const notes = await db
    .select({ userId: notifications.userId, type: notifications.type, payload: notifications.payload })
    .from(notifications)
    .where(inArray(notifications.userId, made));
  const types = notes
    .map((n) => `${n.type}:${n.userId === org ? "org" : n.userId === late ? "late" : "waiting"}`)
    .sort();
  expect(types).toEqual(["spot_freed:org", "ticket_dropped:late", "ticket_reminder:waiting"]);
  expect(notes.find((n) => n.type === "spot_freed")?.payload).toEqual({ tripId: t1, n: "1", text: "1" });
  expect(await db.select().from(reliability).where(eq(reliability.tripId, t3))).toEqual([]);
});
