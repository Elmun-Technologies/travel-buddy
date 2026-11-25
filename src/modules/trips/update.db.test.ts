// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { notifications, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { decideRequest, requestJoin } from "@/modules/groups/service";
import { saveProfile } from "@/modules/profiles/service";
import { createTrip, getTripView, updateTrip, type UpdateTripPatch } from "./service";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 5e9;
const created: string[] = [];

async function newUser(n: number, gender: "female" | "male" = "male") {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST edit ${n}`,
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
  expect(await verifyPhoneFromTelegram(base + n, `+99893${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}

const input = {
  title: "TEST edit trip",
  destinationCountry: "GE" as const,
  destinationCity: null,
  startDate: plusDays(20),
  endDate: plusDays(25),
  dateFlexDays: 0,
  budgetMin: 50000,
  budgetMax: 65000,
  currency: "USD" as const,
  travelStyles: ["mountains" as const],
  groupSizeMax: 3,
  ageMin: null,
  ageMax: null,
  womenOnly: false,
  accommodationPref: "any" as const,
  description: null,
  datePrecision: "exact" as const,
};
const patch = (over: Partial<UpdateTripPatch> = {}): UpdateTripPatch => ({
  title: "TEST edited",
  startDate: input.startDate,
  endDate: input.endDate,
  datePrecision: "exact",
  dateFlexDays: 0,
  budgetMin: input.budgetMin,
  budgetMax: input.budgetMax,
  travelStyles: ["beach"],
  groupSizeMax: 3,
  womenOnly: false,
  description: "new note",
  ...over,
});

describe.runIf(run)("organizer edits a trip (db)", () => {
  afterAll(async () => {
    const db = getDb();
    await db.delete(trips).where(inArray(trips.ownerUserId, created));
    await db.delete(users).where(inArray(users.id, created));
  });

  it("only the organizer, only before departure, never below the group size", async () => {
    const owner = await newUser(1);
    const a = await newUser(2);
    const b = await newUser(3);
    const res = await createTrip(owner, input);
    if (!res.ok) throw new Error("trip");
    expect(await updateTrip(a, res.id, patch())).toEqual({ ok: false, error: "forbidden" });
    expect(await updateTrip(owner, "00000000-0000-4000-8000-0000000000aa", patch())).toEqual({
      ok: false,
      error: "not_found",
    });

    await requestJoin(a, res.id, null);
    await requestJoin(b, res.id, null);
    await decideRequest(owner, res.id, a, true);
    await decideRequest(owner, res.id, b, true);
    expect((await getTripView(res.id, null))?.status).toBe("full");
    expect(await updateTrip(owner, res.id, patch({ groupSizeMax: 2 }))).toEqual({
      ok: false,
      error: "size_below_members",
    });
    // raising the size reopens it; shrinking to the exact count makes it full again
    expect(await updateTrip(owner, res.id, patch({ groupSizeMax: 6 }))).toEqual({ ok: true });
    expect((await getTripView(res.id, null))?.status).toBe("open");
    expect(await updateTrip(owner, res.id, patch({ groupSizeMax: 3 }))).toEqual({ ok: true });
    expect((await getTripView(res.id, null))?.status).toBe("full");
    const v = await getTripView(res.id, null);
    expect(v?.description).toBe("new note");
    expect(v?.travelStyles).toEqual(["beach"]);

    // women-only cannot be switched on once others joined
    expect(await updateTrip(owner, res.id, patch({ womenOnly: true }))).toEqual({
      ok: false,
      error: "women_only_creator",
    });

    // a trip that already started is not editable
    await getDb()
      .update(trips)
      .set({ startDate: plusDays(-1) })
      .where(eq(trips.id, res.id));
    expect(await updateTrip(owner, res.id, patch())).toEqual({ ok: false, error: "started" });
  });

  it("changing the dates tells the group; changing only the note does not", async () => {
    const owner = await newUser(10);
    const member = await newUser(11);
    const res = await createTrip(owner, { ...input, groupSizeMax: 5 });
    if (!res.ok) throw new Error("trip");
    await requestJoin(member, res.id, null);
    await decideRequest(owner, res.id, member, true);
    const told = () =>
      getDb()
        .select()
        .from(notifications)
        .where(and(eq(notifications.userId, member), eq(notifications.type, "trip_updated")));
    expect(await updateTrip(owner, res.id, patch({ groupSizeMax: 5 }))).toEqual({ ok: true });
    expect(await told()).toHaveLength(0);
    expect(
      await updateTrip(
        owner,
        res.id,
        patch({ groupSizeMax: 5, startDate: plusDays(22), endDate: plusDays(27) }),
      ),
    ).toEqual({ ok: true });
    expect(await told()).toHaveLength(1);
  });

  it("women-only: only a woman, and only while nobody else is in the group", async () => {
    const woman = await newUser(20, "female");
    const man = await newUser(21);
    const mine = await createTrip(woman, input);
    const his = await createTrip(man, input);
    if (!mine.ok || !his.ok) throw new Error("trip");
    expect(await updateTrip(man, his.id, patch({ womenOnly: true }))).toEqual({
      ok: false,
      error: "women_only_creator",
    });
    expect(await updateTrip(woman, mine.id, patch({ womenOnly: true }))).toEqual({ ok: true });
    expect((await getTripView(mine.id, null))?.womenOnly).toBe(true);
  });
});
