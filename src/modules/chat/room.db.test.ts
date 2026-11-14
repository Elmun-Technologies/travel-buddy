import { eq } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { conversationMembers, conversations, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { block } from "@/modules/moderation/service";
import { createPoll, getPolls, getRoom, listMessages, sendMessage, vote } from "./service";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];

async function setup() {
  const db = getDb();
  const ids = await Promise.all(
    [0, 1, 2].map(
      async () => (await db.insert(users).values({ locale: "uz" }).returning({ id: users.id }))[0].id,
    ),
  );
  made.push(...ids);
  const [a, b, outsider] = ids;
  const [trip] = await db
    .insert(trips)
    .values({
      kind: "independent",
      ownerUserId: a,
      title: "TEST room",
      destinationCountry: "GE",
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      status: "open",
      isTest: true,
    })
    .returning({ id: trips.id });
  const [c] = await db
    .insert(conversations)
    .values({ kind: "trip_group", tripId: trip.id })
    .returning({ id: conversations.id });
  await db.insert(conversationMembers).values([a, b].map((userId) => ({ conversationId: c.id, userId })));
  return { a, b, outsider, tripId: trip.id, conv: c.id };
}

afterAll(async () => {
  if (!run) return;
  for (const id of made) {
    await getDb().delete(trips).where(eq(trips.ownerUserId, id));
    await getDb().delete(users).where(eq(users.id, id));
  }
});

it.runIf(run)("room: members only, blocked senders hidden, one vote per person", async () => {
  const { a, b, outsider, tripId, conv } = await setup();
  expect(await getRoom(outsider, tripId)).toBeNull();
  expect((await getRoom(b, tripId))?.id).toBe(conv);

  await sendMessage(conv, a, "salom");
  await sendMessage(conv, b, "salom hammaga");
  expect((await listMessages(conv, a)).map((m) => m.body)).toEqual(["salom", "salom hammaga"]);
  await block(a, b);
  expect((await listMessages(conv, a)).map((m) => m.body)).toEqual(["salom"]);

  const pollId = await createPoll(conv, a, "Qayerda qolamiz?", ["Mehmon uyi", "Mehmonxona"]);
  const [o1, o2] = (await getPolls(conv, [pollId], a))[pollId].options;
  expect(await vote(conv, pollId, o1.id, a)).toBe(true);
  expect(await vote(conv, pollId, o2.id, a)).toBe(true); // changing the vote, not adding one
  const p = (await getPolls(conv, [pollId], a))[pollId];
  expect(p.voters).toBe(1);
  expect(p.options.map((o) => o.votes)).toEqual([0, 1]);
  expect(p.mine).toBe(o2.id);
  expect(await vote("00000000-0000-4000-8000-000000000000", pollId, o1.id, a)).toBe(false); // wrong room
});
