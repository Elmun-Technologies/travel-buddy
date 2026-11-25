// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { blocks, notifications, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { decideRequest, requestJoin } from "@/modules/groups/service";
import { saveProfile } from "@/modules/profiles/service";
import { createTrip } from "@/modules/trips/service";
import { canChat, getChat, listDirect, listMessages, notifyDirect, openDirect, sendMessage } from "./service";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 1.2e10;
const created: string[] = [];

async function newUser(n: number) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST dm ${n}`,
    birthDate: "1998-03-01",
    gender: "male",
    showGender: false,
    city: null,
    country: "UZ",
    languages: ["uz"],
    travelStyles: [],
    interests: [],
    bio: null,
  });
  expect(await verifyPhoneFromTelegram(base + n, `+99896${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}

describe.runIf(run)("direct chats (db)", () => {
  afterAll(async () => {
    await getDb().delete(trips).where(inArray(trips.ownerUserId, created));
    await getDb().delete(users).where(inArray(users.id, created));
  });

  it("only people from one approved group, one conversation per pair, blocks stop it, pings are throttled", async () => {
    const [org, a, stranger] = await Promise.all([1, 2, 3].map((n) => newUser(300 + n)));
    const res = await createTrip(org, {
      title: "TEST dm trip",
      destinationCountry: "GE",
      destinationCity: null,
      startDate: plusDays(10),
      endDate: plusDays(14),
      dateFlexDays: 0,
      budgetMin: null,
      budgetMax: null,
      currency: "USD",
      travelStyles: [],
      groupSizeMax: 6,
      ageMin: null,
      ageMax: null,
      womenOnly: false,
      accommodationPref: "any",
      description: null,
      datePrecision: "exact",
    });
    if (!res.ok) throw new Error("trip");
    await requestJoin(a, res.id, null);
    expect(await canChat(a, org)).toBe("no_shared_trip"); // only requested
    await decideRequest(org, res.id, a, true);
    expect(await canChat(a, org)).toBe("ok");
    expect(await canChat(stranger, org)).toBe("no_shared_trip");
    expect(await canChat(a, a)).toBe("self");

    const one = await openDirect(a, org);
    const two = await openDirect(org, a);
    if (!one.ok || !two.ok) throw new Error("open");
    expect(one.id).toBe(two.id); // the same conversation from either side
    expect(await openDirect(stranger, org)).toEqual({ ok: false, error: "no_shared_trip" });

    // a stranger is not a member
    expect(await getChat(stranger, one.id)).toBeNull();
    expect((await getChat(a, one.id))?.canWrite).toBe(true);

    await sendMessage(one.id, a, "Salom!");
    await notifyDirect(one.id, a);
    await sendMessage(one.id, a, "Yana bir narsa");
    await notifyDirect(one.id, a); // within 10 minutes: no second ping
    const pings = await getDb()
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, org), eq(notifications.type, "dm")));
    expect(pings).toHaveLength(1);
    const list = await listDirect(org);
    expect(list[0]).toMatchObject({ id: one.id, otherId: a, unread: true, preview: "Yana bir narsa" });

    // after a block: no chat in the list, no writing, no new conversation
    await getDb().insert(blocks).values({ blockerId: org, blockedId: a });
    expect(await listDirect(org)).toEqual([]);
    expect((await getChat(a, one.id))?.canWrite).toBe(false);
    expect(await openDirect(a, org)).toEqual({ ok: false, error: "blocked" });
    expect(await listMessages(one.id, org)).toEqual([]); // the blocked person's messages are hidden
  });
});
