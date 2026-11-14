// Integration test against a real Postgres (runs when DATABASE_URL is set, e.g. CI / local docker).
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { authAccounts, blocks, conversationMembers, tripMembers, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { saveProfile } from "@/modules/profiles/service";
import { createTrip, getTripView, listFeed } from "@/modules/trips/service";
import { decideRequest, leaveTrip, requestJoin } from "./service";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 1e9; // unique fake Telegram ids per run
const created: string[] = [];

async function newUser(n: number, gender: "female" | "male" = "male", phone = true) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST user ${n}`,
    birthDate: "1998-03-01",
    gender,
    showGender: false,
    city: null,
    country: "UZ",
    languages: ["uz"],
    travelStyles: [],
    interests: [],
    bio: null,
  });
  if (phone)
    expect(await verifyPhoneFromTelegram(base + n, `+99890${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}

const trip = {
  title: "TEST Tbilisi trip",
  destinationCountry: "GE" as const,
  destinationCity: null,
  startDate: plusDays(20),
  endDate: plusDays(25),
  dateFlexDays: 0,
  budgetMin: 50000,
  budgetMax: 65000,
  currency: "USD" as const,
  travelStyles: ["mountains" as const],
  groupSizeMax: 2,
  ageMin: null,
  ageMax: null,
  womenOnly: false,
  accommodationPref: "any" as const,
  description: null,
  datePrecision: "exact" as const,
};

describe.runIf(run)("trip + join flow (db)", () => {
  afterAll(async () => {
    const db = getDb();
    const ids = await db.select({ id: trips.id }).from(trips).where(inArray(trips.ownerUserId, created));
    await db.delete(trips).where(
      inArray(
        trips.id,
        ids.map((r) => r.id),
      ),
    );
    await db.delete(users).where(inArray(users.id, created));
  });

  it("same Telegram id logs into the same account", async () => {
    const a = await loginWithTelegram({ id: base + 99 }, "ru");
    const b = await loginWithTelegram({ id: base + 99 }, "uz");
    expect(a.ok && b.ok && a.userId === b.userId && a.isNew && !b.isNew).toBe(true);
    if (a.ok) created.push(a.userId);
  });

  it("phone: one verified number per account; unknown telegram id → no_user", async () => {
    const u = await newUser(1);
    const [row] = await getDb().select().from(users).where(eq(users.id, u));
    const other = await newUser(2, "male", false);
    const [acc] = await getDb().select().from(authAccounts).where(eq(authAccounts.userId, other));
    expect(await verifyPhoneFromTelegram(Number(acc.providerUserId), row.phone!)).toBe("phone_taken");
    expect(await verifyPhoneFromTelegram(1, "+998901234567")).toBe("no_user");
  });

  it("create → request → approve → full → leave reopens", async () => {
    const owner = await newUser(10);
    const joiner = await newUser(11, "male", false);
    const late = await newUser(12);

    const noPhone = await createTrip(joiner, trip);
    expect(noPhone).toEqual({ ok: false, error: "phone_required" });
    const womenOnly = await createTrip(owner, { ...trip, womenOnly: true });
    expect(womenOnly).toEqual({ ok: false, error: "women_only_creator" });

    const res = await createTrip(owner, trip);
    if (!res.ok) throw new Error(res.error);
    const id = res.id;
    expect((await listFeed(null, { page: 1, country: ["GE"] })).items.some((t) => t.id === id)).toBe(true);

    expect(await requestJoin(owner, id, null)).toEqual({ ok: false, error: "own_trip" });
    expect(await requestJoin(joiner, id, "hi")).toEqual({ ok: true });
    expect(await requestJoin(joiner, id, "again")).toEqual({ ok: false, error: "already" });
    expect(await decideRequest(joiner, id, joiner, true)).toEqual({ ok: false, error: "forbidden" });
    expect(await decideRequest(owner, id, joiner, true)).toEqual({ ok: true });

    expect((await getTripView(id, null))?.approvedCount).toBe(2);
    // group of 2 (owner + joiner) is now full
    expect((await getTripView(id, null))?.status).toBe("full");
    expect(await requestJoin(late, id, null)).toEqual({ ok: false, error: "full" });
    const chat = await getDb()
      .select()
      .from(conversationMembers)
      .where(eq(conversationMembers.userId, joiner));
    expect(chat).toHaveLength(1);

    await leaveTrip(joiner, id);
    expect((await getTripView(id, null))?.status).toBe("open");
    const [m] = await getDb().select().from(tripMembers).where(eq(tripMembers.userId, joiner));
    expect(m.status).toBe("left");
  });

  it("blocked users don't see each other's trips and can't join", async () => {
    const owner = await newUser(20);
    const blocker = await newUser(21);
    const res = await createTrip(owner, { ...trip, groupSizeMax: 5 });
    if (!res.ok) throw new Error(res.error);
    await getDb().insert(blocks).values({ blockerId: blocker, blockedId: owner });
    expect((await listFeed(blocker, { page: 1, country: ["GE"] })).items.some((t) => t.id === res.id)).toBe(
      false,
    );
    expect(await getTripView(res.id, blocker)).toBeNull();
    expect(await requestJoin(blocker, res.id, null)).toEqual({ ok: false, error: "blocked" });
  });
});
