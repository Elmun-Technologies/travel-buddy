// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { blocks, reviews, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { decideRequest, requestJoin } from "@/modules/groups/service";
import { saveProfile } from "@/modules/profiles/service";
import { createTrip } from "@/modules/trips/service";
import { ratingsOf, reviewable, submitReview } from "./service";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 7e9;
const created: string[] = [];

async function newUser(n: number) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST rev ${n}`,
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
  expect(await verifyPhoneFromTelegram(base + n, `+99894${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}

describe.runIf(run)("reviews after a trip (db)", () => {
  afterAll(async () => {
    const mine = await getDb()
      .select({ id: trips.id })
      .from(trips)
      .where(inArray(trips.ownerUserId, created));
    if (mine.length)
      await getDb()
        .delete(reviews)
        .where(
          inArray(
            reviews.tripId,
            mine.map((t) => t.id),
          ),
        );
    await getDb().delete(trips).where(inArray(trips.ownerUserId, created));
    await getDb().delete(users).where(inArray(users.id, created));
  });

  it("only companions of a finished trip rate each other; the average shows from 3 ratings", async () => {
    const db = getDb();
    const [org, a, b, c, outsider] = await Promise.all([1, 2, 3, 4, 5].map((n) => newUser(100 + n)));
    const res = await createTrip(org, {
      title: "TEST rev trip",
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
    for (const u of [a, b, c]) {
      await requestJoin(u, res.id, null);
      await decideRequest(org, res.id, u, true);
    }
    // not finished yet: nothing to rate
    expect(await reviewable(a, res.id)).toBeNull();
    await db.update(trips).set({ status: "completed" }).where(eq(trips.id, res.id));

    expect((await reviewable(outsider, res.id)) ?? null).toBeNull();
    expect((await reviewable(a, res.id))?.people).toHaveLength(3); // org, b, c
    expect(await submitReview(outsider, res.id, org, 5, null)).toEqual({ ok: false, error: "not_found" });
    expect(await submitReview(a, res.id, outsider, 5, null)).toEqual({ ok: false, error: "forbidden" });
    expect(await submitReview(a, res.id, a, 5, null)).toEqual({ ok: false, error: "forbidden" });

    expect(await submitReview(a, res.id, org, 5, "great")).toEqual({ ok: true });
    expect(await submitReview(b, res.id, org, 4, null)).toEqual({ ok: true });
    expect((await ratingsOf([org])).has(org)).toBe(false); // two are not enough
    expect(await submitReview(c, res.id, org, 3, null)).toEqual({ ok: true });
    expect(await ratingsOf([org])).toEqual(new Map([[org, { avg: 4, count: 3 }]]));
    // rating again replaces the first one
    expect(await submitReview(c, res.id, org, 5, null)).toEqual({ ok: true });
    expect((await ratingsOf([org])).get(org)).toEqual({ avg: 4.7, count: 3 });
    expect((await reviewable(a, res.id))?.people.find((p) => p.id === org)?.rating).toBe(5);

    // a blocked person can no longer be rated
    await db.insert(blocks).values({ blockerId: a, blockedId: b });
    expect((await reviewable(a, res.id))?.people.some((p) => p.id === b)).toBe(false);
  });
});
