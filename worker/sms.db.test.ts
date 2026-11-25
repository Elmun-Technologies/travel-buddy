import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { authAccounts, notifications, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { deliverNotifications } from "./notify";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];

afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  if (!run) return;
  await getDb().delete(trips).where(inArray(trips.ownerUserId, made));
  await getDb().delete(users).where(inArray(users.id, made));
});

describe.runIf(run)("SMS fallback when the bot is blocked", () => {
  it("texts only people who agreed, with a verified Uzbek phone, SOS and offers only, max 3 a day", async () => {
    process.env.SMS_PROVIDER = "eskiz";
    process.env.ESKIZ_EMAIL = "a@b.uz";
    process.env.ESKIZ_PASSWORD = "x";
    const db = getDb();
    const mk = async (consent: boolean, n: number) => {
      const [u] = await db
        .insert(users)
        .values({ locale: "uz", phone: `+9989000${n}0000`, phoneVerified: true, smsConsent: consent })
        .returning({ id: users.id });
      made.push(u.id);
      await db
        .insert(authAccounts)
        .values({
          userId: u.id,
          provider: "telegram",
          providerUserId: String(8_000_000 + n + Math.floor(Math.random() * 1e6)),
        });
      return u.id;
    };
    const [agreed, refused] = [await mk(true, 1), await mk(false, 2)];
    const [trip] = await db
      .insert(trips)
      .values({
        kind: "independent",
        ownerUserId: agreed,
        title: "TEST sms",
        destinationCountry: "GE",
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        status: "open",
        isTest: true,
      })
      .returning({ id: trips.id });
    const queue = async (userId: string, type: string) =>
      db
        .insert(notifications)
        .values({ userId, type, payload: { tripId: trip.id, memberId: agreed }, channel: "telegram" });

    const texts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (String(url).endsWith("/auth/login")) return Response.json({ data: { token: "t" } });
        texts.push(String((init?.body as FormData).get("message")));
        return Response.json({ status: "waiting" });
      }),
    );
    const blocked = {
      sendMessage: async () =>
        Promise.reject(Object.assign(new Error("Forbidden: bot was blocked"), { error_code: 403 })),
    };

    await queue(agreed, "sos");
    await queue(refused, "sos");
    await queue(agreed, "join_approved"); // not an SOS or an offer: never a text
    await deliverNotifications(blocked as never, db, "https://x.test");
    expect(texts).toHaveLength(1);
    expect(texts[0]).toContain("TEST sms");
    expect(texts[0]).toContain("yordam so'ramoqda");
    // all three were finished (the blocked bot is final), so nothing is retried
    expect(
      (await db.select().from(notifications).where(eq(notifications.userId, agreed))).every((n) => n.sentAt),
    ).toBe(true);

    // the daily cap: 3 texts in total for one person
    for (let i = 0; i < 4; i++) await queue(agreed, "sos");
    await deliverNotifications(blocked as never, db, "https://x.test");
    expect(texts).toHaveLength(3);
  });
});
