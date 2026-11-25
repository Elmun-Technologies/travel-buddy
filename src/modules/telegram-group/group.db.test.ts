// Integration test against a real Postgres (runs when DATABASE_URL is set).
import http from "node:http";
import type { AddressInfo } from "node:net";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { notifications, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { getRoom, setPinned } from "@/modules/chat/service";
import { decideRequest, requestJoin } from "@/modules/groups/service";
import { saveProfile } from "@/modules/profiles/service";
import { createTrip } from "@/modules/trips/service";
import { completeLink, groupStatus, memberInvite, startLink, unlinkGroup } from "./service";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 1.6e10;
const created: string[] = [];

async function newUser(n: number) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST tg ${n}`,
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
  expect(await verifyPhoneFromTelegram(base + n, `+99890${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}
const trip = {
  title: "TEST tg trip",
  destinationCountry: "GE" as const,
  destinationCity: null,
  startDate: plusDays(20),
  endDate: plusDays(25),
  dateFlexDays: 0,
  budgetMin: null,
  budgetMax: null,
  currency: "USD" as const,
  travelStyles: [],
  groupSizeMax: 6,
  ageMin: null,
  ageMax: null,
  womenOnly: false,
  accommodationPref: "any" as const,
  description: null,
  datePrecision: "exact" as const,
};

describe.runIf(run)("the trip's Telegram group (db)", () => {
  afterAll(async () => {
    await getDb().delete(trips).where(inArray(trips.ownerUserId, created));
    await getDb().delete(users).where(inArray(users.id, created));
  });

  it("one-time code, only the organizer links, one group per trip, posts and personal invites", async () => {
    const db = getDb();
    const [org, member, outsider] = await Promise.all([1, 2, 3].map((n) => newUser(400 + n)));
    const made = await createTrip(org, trip);
    if (!made.ok) throw new Error("trip");
    await requestJoin(member, made.id, null);
    await decideRequest(org, made.id, member, true);

    expect(await startLink(member, made.id)).toBeNull(); // only the organizer asks for a code
    const code = (await startLink(org, made.id))!;
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{8}$/);
    expect((await groupStatus(org, made.id))?.code).toBe(code);
    expect((await groupStatus(member, made.id))?.code).toBeNull(); // members never see the code
    expect(await groupStatus(outsider, made.id)).toBeNull();

    expect(await completeLink("WRONGCDE", "-100111", "G", base + 401)).toEqual({
      ok: false,
      error: "bad_code",
    });
    expect(await completeLink(code, "-100111", "G", base + 402)).toEqual({
      ok: false,
      error: "not_organizer",
    });
    expect(await completeLink(code, "-100111", "Gruziya guruhi", base + 401)).toEqual({
      ok: true,
      tripTitle: "TEST tg trip",
    });
    expect(await completeLink(code, "-100222", "G2", base + 401)).toEqual({ ok: false, error: "bad_code" }); // used once
    expect(await groupStatus(member, made.id)).toMatchObject({ linked: true, chatTitle: "Gruziya guruhi" });

    // another trip cannot take the same group
    const other = await createTrip(org, { ...trip, title: "TEST tg other" });
    if (!other.ok) throw new Error("trip 2");
    const code2 = (await startLink(org, other.id))!;
    expect(await completeLink(code2, "-100111", "G", base + 401)).toEqual({ ok: false, error: "chat_taken" });

    // a pinned notice is also queued for the group (to the organizer's row, redirected by chatId)
    const room = (await getRoom(org, made.id))!;
    await setPinned(room.id, "Uchrashuv 06:00", org);
    const posts = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, org), eq(notifications.type, "group_post")));
    expect(posts).toHaveLength(1);
    expect(posts[0].payload).toMatchObject({
      tripId: made.id,
      chatId: "-100111",
      kind: "pin",
      text: "Uchrashuv 06:00",
    });

    // personal invite: asked from Telegram with member_limit 1; only members get one
    let asked: Record<string, unknown> = {};
    const api = http.createServer((req, res) => {
      let b = "";
      req.on("data", (c) => (b += c));
      req.on("end", () => {
        asked = JSON.parse(b);
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ ok: true, result: { invite_link: "https://t.me/+abc" } }));
      });
    });
    await new Promise<void>((r) => api.listen(0, "127.0.0.1", r));
    process.env.TELEGRAM_BOT_TOKEN = "1:test";
    process.env.TELEGRAM_API_ROOT = `http://127.0.0.1:${(api.address() as AddressInfo).port}`;
    try {
      expect(await memberInvite(member, made.id)).toEqual({ ok: true, link: "https://t.me/+abc" });
      expect(asked).toMatchObject({ chat_id: "-100111", member_limit: 1 });
      expect(await memberInvite(outsider, made.id)).toEqual({ ok: false, error: "not_linked" });
    } finally {
      api.close();
      delete process.env.TELEGRAM_API_ROOT;
    }

    expect(await unlinkGroup(member, made.id)).toBe(false);
    expect(await unlinkGroup(org, made.id)).toBe(true);
    expect((await groupStatus(org, made.id))?.linked).toBe(false);
  });
});
