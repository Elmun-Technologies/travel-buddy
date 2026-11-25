// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { blocks, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { decideRequest, requestJoin } from "@/modules/groups/service";
import { saveProfile } from "@/modules/profiles/service";
import { createTrip } from "@/modules/trips/service";
import {
  addPhoto,
  albumAccess,
  listAlbum,
  photoKeyFor,
  removePhoto,
  saveStory,
  listMyMemories,
  consentState,
  publicPhotoKey,
  publicStory,
  setConsent,
} from "./service";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 8e9;
const created: string[] = [];

async function newUser(n: number) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST album ${n}`,
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
  expect(await verifyPhoneFromTelegram(base + n, `+99895${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}

describe.runIf(run)("album and stories (db)", () => {
  afterAll(async () => {
    await getDb().delete(trips).where(inArray(trips.ownerUserId, created));
    await getDb().delete(users).where(inArray(users.id, created));
  });

  it("opens when the trip starts, only for the group; blocked authors are hidden; stories are one per person", async () => {
    const db = getDb();
    const [org, a, b, outsider] = await Promise.all([1, 2, 3, 4].map((n) => newUser(200 + n)));
    const res = await createTrip(org, {
      title: "TEST album trip",
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
    for (const u of [a, b]) {
      await requestJoin(u, res.id, null);
      await decideRequest(org, res.id, u, true);
    }
    expect(await albumAccess(a, res.id)).toBeNull(); // not started

    await db
      .update(trips)
      .set({ startDate: plusDays(-1) })
      .where(eq(trips.id, res.id));
    expect(await albumAccess(a, res.id)).not.toBeNull();
    expect(await albumAccess(outsider, res.id)).toBeNull();

    const pa = await addPhoto(a, res.id, "photos/00000000-0000-4000-8000-000000000001.webp", null);
    const pb = await addPhoto(b, res.id, "photos/00000000-0000-4000-8000-000000000002.webp", "Kazbegi");
    expect(await photoKeyFor(org, pa)).toBe("photos/00000000-0000-4000-8000-000000000001.webp");
    expect(await photoKeyFor(outsider, pa)).toBeNull();
    expect((await listAlbum(org, res.id)).photos).toHaveLength(2);

    await db.insert(blocks).values({ blockerId: a, blockedId: b });
    expect((await listAlbum(a, res.id)).photos.map((p) => p.id)).toEqual([pa]);
    expect(await photoKeyFor(a, pb)).toBeNull();

    // a person removes their own photo; someone else cannot; the organizer can
    expect(await removePhoto(a, res.id, pb)).toBeNull();
    expect(await removePhoto(org, res.id, pb)).toBe("photos/00000000-0000-4000-8000-000000000002.webp");

    await saveStory(a, res.id, "Zo'r safar edi");
    await saveStory(a, res.id, "Juda zo'r safar edi");
    const stories = (await listAlbum(org, res.id)).stories;
    expect(stories).toHaveLength(1);
    expect(stories[0].body).toBe("Juda zo'r safar edi");

    expect((await listMyMemories(a)).map((m) => m.id)).toContain(res.id);
    expect(await listMyMemories(outsider)).toEqual([]);
  });

  it("public story page opens only when every member agreed, and closes when one withdraws", async () => {
    const db = getDb();
    const [org, a, outsider] = await Promise.all([1, 2, 3].map((n) => newUser(300 + n)));
    const res = await createTrip(org, {
      title: "TEST story trip",
      destinationCountry: "GE",
      destinationCity: "Tbilisi",
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
    await decideRequest(org, res.id, a, true);
    await db
      .update(trips)
      .set({ startDate: plusDays(-6), endDate: plusDays(-2) })
      .where(eq(trips.id, res.id));
    const [{ code }] = await db.select({ code: trips.publicCode }).from(trips).where(eq(trips.id, res.id));
    const photo = await addPhoto(a, res.id, "photos/00000000-0000-4000-8000-000000000009.webp", null);

    // not finished yet: nobody can switch it on
    expect(await setConsent(a, res.id, true)).toBe(false);
    await db.update(trips).set({ status: "completed" }).where(eq(trips.id, res.id));

    expect(await setConsent(outsider, res.id, true)).toBe(false);
    expect(await setConsent(a, res.id, true)).toBe(true);
    expect(await publicStory(code!)).toBeNull(); // organizer has not agreed
    expect(await publicPhotoKey(photo)).toBeNull();
    expect(await consentState(a, res.id)).toMatchObject({ agreed: 1, total: 2, mine: true, code: null });

    expect(await setConsent(org, res.id, true)).toBe(true);
    const open = await publicStory(code!);
    expect(open?.people.sort()).toEqual(["TEST album 301", "TEST album 302"]);
    expect(open?.photos.map((p) => p.id)).toEqual([photo]);
    expect(await publicPhotoKey(photo)).toBe("photos/00000000-0000-4000-8000-000000000009.webp");
    expect((await consentState(org, res.id)).code).toBe(code);

    await setConsent(a, res.id, false); // one person withdraws: everything goes offline
    expect(await publicStory(code!)).toBeNull();
    expect(await publicPhotoKey(photo)).toBeNull();
    expect(await publicStory("bad code")).toBeNull();
  });
});
