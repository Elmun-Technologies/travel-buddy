import { and, eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import {
  blocks,
  conversationMembers,
  conversations,
  messages,
  notifications,
  trips,
  users,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { notifyRoom } from "@/modules/notifications/service";
import { queueDigests, render } from "./notify";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];

afterAll(async () => {
  if (!run) return;
  await getDb().delete(trips).where(inArray(trips.ownerUserId, made));
  await getDb().delete(users).where(inArray(users.id, made));
});

it.runIf(run)("chat digest: once an hour, unread only, respects blocks and the off switch", async () => {
  const db = getDb();
  const mk = async (notifyOff: string[] = []) =>
    (await db.insert(users).values({ locale: "uz", notifyOff }).returning({ id: users.id }))[0].id;
  const [a, b, c, quiet] = [await mk(), await mk(), await mk(), await mk(["chat"])];
  made.push(a, b, c, quiet);
  const [trip] = await db
    .insert(trips)
    .values({
      kind: "independent",
      ownerUserId: a,
      title: "TEST notify",
      destinationCountry: "GE",
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      status: "open",
      isTest: true,
    })
    .returning({ id: trips.id });
  const [conv] = await db.insert(conversations).values({ kind: "trip_group", tripId: trip.id }).returning();
  const old = new Date(Date.now() - 3 * 3600_000);
  await db
    .insert(conversationMembers)
    .values([a, b, c, quiet].map((userId) => ({ conversationId: conv.id, userId, createdAt: old })));
  await db.insert(blocks).values({ blockerId: c, blockedId: a });
  const ago = new Date(Date.now() - 5 * 60_000);
  await db.insert(messages).values([
    { conversationId: conv.id, senderId: a, body: "1", createdAt: ago },
    { conversationId: conv.id, senderId: a, body: "2", createdAt: ago },
    { conversationId: conv.id, senderId: a, body: "live" }, // too fresh: waits
  ]);

  await queueDigests(db);
  await queueDigests(db); // second run inside the hour: nothing new
  const got = await db
    .select({ userId: notifications.userId, payload: notifications.payload })
    .from(notifications)
    .where(and(eq(notifications.type, "room_digest"), inArray(notifications.userId, made)));
  // a wrote them; c blocked a; quiet turned chat off → only b, once, with 2 messages.
  expect(got).toEqual([{ userId: b, payload: { tripId: trip.id, n: "2" } }]);

  // Pin/poll fan-out: everyone but the sender and people blocked either way.
  await db.transaction((tx) => notifyRoom(tx, conv.id, a, "room_pin", { tripId: trip.id, text: "06:00" }));
  const pins = await db
    .select({ userId: notifications.userId })
    .from(notifications)
    .where(and(eq(notifications.type, "room_pin"), inArray(notifications.userId, made)));
  expect(pins.map((p) => p.userId).sort()).toEqual([b, quiet].sort()); // quiet gets it: only chat is off

  const m = render(
    { type: "room_digest", trip: "Gruziya <3>", organizer: null, member: null, text: null, n: "5" },
    "uz",
  );
  expect(m?.body).toBe("«Gruziya &lt;3&gt;» guruhida 5 ta yangi xabar.");
});
