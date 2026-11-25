// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { blocks, matchSuggestions, notifications, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { saveProfile } from "@/modules/profiles/service";
import { createIntent, createTrip } from "@/modules/trips/service";
import { candidatesForTrip, inviteCandidate, runMatching } from "./jobs";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 1.5e10;
const created: string[] = [];

async function newUser(
  n: number,
  over: { gender?: "female" | "male"; dreams?: string[]; styles?: string[] } = {},
) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST match ${n}`,
    birthDate: "1998-03-01",
    gender: over.gender ?? "male",
    showGender: false,
    city: null,
    country: "UZ",
    languages: ["uz"],
    travelStyles: (over.styles ?? ["city"]) as never,
    interests: [],
    bio: null,
    dreamDestinations: (over.dreams ?? []) as never,
  });
  expect(await verifyPhoneFromTelegram(base + n, `+99899${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}

const trip = (over: object = {}) => ({
  title: "TEST match trip",
  destinationCountry: "JP" as const, // a country nobody else uses in the shared test database
  destinationCity: null,
  startDate: plusDays(20),
  endDate: plusDays(25),
  dateFlexDays: 0,
  budgetMin: null,
  budgetMax: null,
  currency: "USD" as const,
  travelStyles: ["city" as const],
  groupSizeMax: 6,
  ageMin: null,
  ageMax: null,
  womenOnly: false,
  accommodationPref: "any" as const,
  description: null,
  datePrecision: "exact" as const,
  ...over,
});

describe.runIf(run)("background matching (db)", () => {
  afterAll(async () => {
    await getDb().delete(trips).where(inArray(trips.ownerUserId, created));
    await getDb().delete(users).where(inArray(users.id, created));
  });

  it("stores good matches once, respects blocks and women-only, tells at most 3 a day", async () => {
    const db = getDb();
    const owner = await newUser(1, { gender: "female" });
    const dreamer = await newUser(2, { dreams: ["JP"] });
    const blocked = await newUser(3, { dreams: ["JP"] });
    const elsewhere = await newUser(4, { dreams: ["TH"] });
    await db.insert(blocks).values({ blockerId: blocked, blockedId: owner });

    const made = await createTrip(owner, trip());
    if (!made.ok) throw new Error("trip");
    const women = await createTrip(
      owner,
      trip({ womenOnly: true, startDate: plusDays(40), endDate: plusDays(45) }),
    );
    if (!women.ok) throw new Error("trip 2");

    const first = await runMatching(db);
    expect(first.stored).toBeGreaterThanOrEqual(1);
    const mine = await db.select().from(matchSuggestions).where(eq(matchSuggestions.userId, dreamer));
    expect(mine.map((m) => m.targetId)).toEqual([made.id]); // women-only trip is not for a man
    expect(await db.select().from(matchSuggestions).where(eq(matchSuggestions.userId, blocked))).toHaveLength(
      0,
    );
    expect(
      await db.select().from(matchSuggestions).where(eq(matchSuggestions.userId, elsewhere)),
    ).toHaveLength(0);

    // told once; running again repeats nothing
    const told = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, dreamer), eq(notifications.type, "match_trip")));
    expect(told).toHaveLength(1);
    expect(told[0].payload).toMatchObject({ tripId: made.id });
    await runMatching(db);
    expect(
      await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, dreamer), eq(notifications.type, "match_trip"))),
    ).toHaveLength(1);

    // the cap: five more fitting trips, only two more messages today (3 in total)
    for (let i = 0; i < 5; i++) {
      const m = await createTrip(
        owner,
        trip({ title: `TEST match extra ${i}`, startDate: plusDays(50 + i), endDate: plusDays(55 + i) }),
      );
      if (!m.ok) throw new Error("extra");
    }
    await runMatching(db);
    expect(
      await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, dreamer), eq(notifications.type, "match_trip"))),
    ).toHaveLength(3);
  });

  it("organizer sees people with a fitting note and can invite each once", async () => {
    const db = getDb();
    const owner = await newUser(10);
    const seeker = await newUser(11);
    const dreamOnly = await newUser(12, { dreams: ["JP"] });
    const made = await createTrip(owner, trip({ startDate: plusDays(60), endDate: plusDays(66) }));
    if (!made.ok) throw new Error("trip");
    await createIntent(seeker, {
      destinationCountry: "JP",
      destinationCity: null,
      startDate: plusDays(59),
      endDate: plusDays(67),
      dateFlexDays: 0,
      budgetMin: null,
      budgetMax: null,
      currency: "USD",
      travelStyles: [],
      note: null,
    });
    const list = await candidatesForTrip(db, owner, made.id);
    expect(list.map((c) => c.userId)).toEqual([seeker]); // a dream alone is not an invitation to be shown
    expect(list[0]).toMatchObject({ name: "TEST match 11", invited: false });
    expect(await candidatesForTrip(db, seeker, made.id)).toEqual([]); // only the organizer sees them
    expect(await inviteCandidate(db, owner, made.id, dreamOnly)).toBe("not_found");
    expect(await inviteCandidate(db, owner, made.id, seeker)).toBe("ok");
    expect(await inviteCandidate(db, owner, made.id, seeker)).toBe("already");
    expect((await candidatesForTrip(db, owner, made.id))[0].invited).toBe(true);
    expect(
      await db
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, seeker), eq(notifications.type, "trip_invite"))),
    ).toHaveLength(1);
  });
});
