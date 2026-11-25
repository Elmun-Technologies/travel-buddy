// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { notifications, reports, sessions, tripMembers, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { decideRequest, leaveTrip, requestJoin, separateAfterBlock } from "@/modules/groups/service";
import { block } from "@/modules/moderation/service";
import { getPublicProfile, saveProfile } from "@/modules/profiles/service";
import { createTrip, getTripView, listFeed } from "@/modules/trips/service";
import { eraseDeletedAccounts, deleteAccount } from "./service";
import { restoreUser } from "@/modules/users/service";
import { deliverNotifications } from "../../../worker/notify";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 3e9;
const created: string[] = [];

async function newUser(n: number) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST account ${n}`,
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
  expect(await verifyPhoneFromTelegram(base + n, `+99891${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}

const trip = {
  title: "TEST account trip",
  destinationCountry: "GE" as const,
  destinationCity: null,
  startDate: plusDays(20),
  endDate: plusDays(25),
  dateFlexDays: 0,
  budgetMin: 50000,
  budgetMax: 65000,
  currency: "USD" as const,
  travelStyles: ["mountains" as const],
  groupSizeMax: 4,
  ageMin: null,
  ageMax: null,
  womenOnly: false,
  accommodationPref: "any" as const,
  description: null,
  datePrecision: "exact" as const,
};

describe.runIf(run)("account deletion, blocks, joins (db)", () => {
  afterAll(async () => {
    const db = getDb();
    await db.delete(trips).where(inArray(trips.ownerUserId, created));
    await db.delete(users).where(inArray(users.id, created));
  });

  it("delete hides the person at once, frees seats, and the erase after 30 days never fails", async () => {
    const db = getDb();
    const organizer = await newUser(1);
    const leaver = await newUser(2);
    const reporter = await newUser(3);
    const mine = await createTrip(leaver, trip);
    const theirs = await createTrip(organizer, trip);
    if (!mine.ok || !theirs.ok) throw new Error("trip");
    expect(await requestJoin(leaver, theirs.id, null)).toEqual({ ok: true });
    expect(await decideRequest(organizer, theirs.id, leaver, true)).toEqual({ ok: true });
    await db
      .insert(reports)
      .values({ reporterId: leaver, targetType: "trip", targetId: theirs.id, reason: "other" });
    await db
      .insert(sessions)
      .values({ userId: leaver, tokenHash: `t${base}`, expiresAt: new Date(Date.now() + 1e6) });

    await deleteAccount(leaver);

    const [u] = await db.select().from(users).where(eq(users.id, leaver));
    expect(u.status).toBe("deleted");
    expect(await db.select().from(sessions).where(eq(sessions.userId, leaver))).toHaveLength(0);
    // their own listing is closed and gone from the feed; their seat in the other group is free
    expect((await getTripView(mine.id, reporter))?.status).toBe("closed");
    expect((await listFeed(reporter, { page: 1, country: ["GE"] })).items.some((t) => t.id === mine.id)).toBe(
      false,
    );
    const seat = await db.select().from(tripMembers).where(eq(tripMembers.tripId, theirs.id));
    expect(seat.find((x) => x.userId === leaver)?.status).toBe("left");
    expect(await getPublicProfile(reporter, leaver)).toBeNull();

    // nothing else is erased yet; a restore within 30 days works
    expect(await db.transaction((tx) => restoreUser(tx, leaver))).toBe(true);
    await deleteAccount(leaver);

    // not yet 30 days: nothing to erase
    expect((await eraseDeletedAccounts(db, () => {})).erased).toBe(0);
    await db
      .update(users)
      .set({ deletedAt: new Date(Date.now() - 31 * 86_400_000) })
      .where(eq(users.id, leaver));
    expect(await db.transaction((tx) => restoreUser(tx, leaver))).toBe(false); // too late
    const r = await eraseDeletedAccounts(db, () => {});
    expect(r).toEqual({ erased: expect.any(Number), failed: 0 });
    expect(await db.select().from(users).where(eq(users.id, leaver))).toHaveLength(0);
    // the trip they opened and the report they filed stay, without their name
    const [kept] = await db.select().from(trips).where(eq(trips.id, mine.id));
    expect(kept.ownerUserId).toBeNull();
    const [rep] = await db.select().from(reports).where(eq(reports.targetId, theirs.id));
    expect(rep.reporterId).toBeNull();
  });

  it("blocking an organizer takes the person out of that group", async () => {
    const organizer = await newUser(10);
    const member = await newUser(11);
    const res = await createTrip(organizer, trip);
    if (!res.ok) throw new Error("trip");
    await requestJoin(member, res.id, null);
    await decideRequest(organizer, res.id, member, true);
    expect(await block(member, organizer)).toBe(true);
    expect(await block(member, "00000000-0000-4000-8000-0000000000ff")).toBe(false);
    await separateAfterBlock(member, organizer);
    const [m] = await getDb().select().from(tripMembers).where(eq(tripMembers.userId, member));
    expect(m.status).toBe("left");
  });

  it("many simultaneous join requests do not hang the connection pool", async () => {
    const organizer = await newUser(20);
    const res = await createTrip(organizer, { ...trip, groupSizeMax: 20 });
    if (!res.ok) throw new Error("trip");
    const people = await Promise.all(Array.from({ length: 12 }, (_, i) => newUser(30 + i)));
    const results = await Promise.all(people.map((p) => requestJoin(p, res.id, null)));
    expect(results.every((r) => r.ok)).toBe(true);
  }, 30_000);

  it("closed or hidden trips cannot take new members; leaving a request keeps the group full", async () => {
    const organizer = await newUser(50);
    const a = await newUser(51);
    const b = await newUser(52);
    const res = await createTrip(organizer, { ...trip, groupSizeMax: 2 });
    if (!res.ok) throw new Error("trip");
    await requestJoin(a, res.id, null);
    await requestJoin(b, res.id, null);
    await decideRequest(organizer, res.id, a, true);
    expect((await getTripView(res.id, null))?.status).toBe("full");
    await leaveTrip(b, res.id); // cancelling a pending request frees no seat
    expect((await getTripView(res.id, null))?.status).toBe("full");
    await getDb().update(trips).set({ status: "hidden" }).where(eq(trips.id, res.id));
    await requestJoin(b, res.id, null).catch(() => {});
    expect(await decideRequest(organizer, res.id, b, true)).toEqual({ ok: false, error: "forbidden" });
  });

  it("notifications are retried after a failed send and marked sent only after success", async () => {
    const db = getDb();
    const organizer = await newUser(60);
    const res = await createTrip(organizer, trip);
    if (!res.ok) throw new Error("trip");
    // the test accounts have Telegram ids, so they are deliverable
    await db.insert(notifications).values({
      userId: organizer,
      type: "join_approved",
      payload: { tripId: res.id },
      channel: "telegram",
    });
    // The shared test database may hold other people's pending messages: only ours is counted.
    let calls = 0;
    const flaky = {
      sendMessage: async (chat: string) => {
        if (chat !== String(base + 60)) return {};
        calls++;
        if (calls === 1) throw Object.assign(new Error("network"), { error_code: 502 });
        return {};
      },
    };
    await deliverNotifications(flaky as never, db, "https://x.test");
    let [n] = await db.select().from(notifications).where(eq(notifications.userId, organizer));
    expect(n.sentAt).toBeNull();
    expect(n.attempts).toBe(1);
    // not due yet: nothing is sent
    await deliverNotifications(flaky as never, db, "https://x.test");
    expect(calls).toBe(1);
    await db
      .update(notifications)
      .set({ nextAttemptAt: new Date(Date.now() - 1000) })
      .where(eq(notifications.userId, organizer));
    await deliverNotifications(flaky as never, db, "https://x.test");
    [n] = await db.select().from(notifications).where(eq(notifications.userId, organizer));
    expect(calls).toBe(2);
    expect(n.sentAt).not.toBeNull();
  });
});
