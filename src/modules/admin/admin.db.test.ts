import { and, eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import {
  agencyRequests,
  auditLogs,
  conversations,
  messages,
  reports,
  sessions,
  tripOptions,
  trips,
  users,
  visaRules,
} from "@/db/schema";
import { getDb } from "@/lib/db";
import { isAdminTelegramId } from "@/modules/auth/service";
import { applyAdminOp } from "./service";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];

afterAll(async () => {
  if (!run) return;
  await getDb().delete(visaRules).where(eq(visaRules.destination, "MV"));
  await getDb().delete(auditLogs).where(inArray(auditLogs.actorId, made));
  await getDb().delete(reports).where(inArray(reports.reporterId, made));
  await getDb().delete(trips).where(inArray(trips.ownerUserId, made));
  await getDb().delete(users).where(inArray(users.id, made));
});

it("admin ids come from ADMIN_TELEGRAM_IDS", () => {
  expect(isAdminTelegramId(42, "1, 42 ,7")).toBe(true);
  expect(isAdminTelegramId("4", "1,42")).toBe(false);
  expect(isAdminTelegramId(1, "")).toBe(false);
});

it.runIf(run)("hide, suspend, visa upsert, partner offer — every action audited", async () => {
  const db = getDb();
  const [admin, bad, reporter] = await Promise.all(
    [0, 1, 2].map(
      async () => (await db.insert(users).values({ locale: "uz" }).returning({ id: users.id }))[0].id,
    ),
  );
  made.push(admin, bad, reporter);
  const [trip] = await db
    .insert(trips)
    .values({
      kind: "independent",
      ownerUserId: bad,
      title: "TEST admin",
      destinationCountry: "GE",
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      status: "open",
      isTest: true,
    })
    .returning({ id: trips.id });
  const [c] = await db.insert(conversations).values({ kind: "trip_group", tripId: trip.id }).returning();
  const [m] = await db
    .insert(messages)
    .values({ conversationId: c.id, senderId: bad, body: "spam" })
    .returning();
  const [rep] = await db
    .insert(reports)
    .values({ reporterId: reporter, targetType: "message", targetId: m.id, reason: "dating" })
    .returning();
  await db
    .insert(sessions)
    .values({ userId: bad, tokenHash: `t-${bad}`, expiresAt: new Date(Date.now() + 864e5) });

  expect(await applyAdminOp(admin, { op: "message.hide", id: m.id, reportId: rep.id }, null)).toBe(true);
  expect((await db.select().from(messages).where(eq(messages.id, m.id)))[0].hiddenAt).not.toBeNull();
  expect((await db.select().from(reports).where(eq(reports.id, rep.id)))[0].status).toBe("resolved");

  // Suspend: logged out everywhere, open trips hidden; restoring brings the account back.
  expect(await applyAdminOp(admin, { op: "user.suspend", id: bad }, "1.2.3.4")).toBe(true);
  expect(await db.select().from(sessions).where(eq(sessions.userId, bad))).toEqual([]);
  expect((await db.select().from(trips).where(eq(trips.id, trip.id)))[0].status).toBe("hidden");
  expect(await applyAdminOp(admin, { op: "user.suspend", id: bad }, null)).toBe(false); // already suspended
  expect(await applyAdminOp(admin, { op: "user.restore", id: bad }, null)).toBe(true);

  // Visa: insert, then the same destination is updated (never duplicated).
  const visa = {
    op: "visa.save" as const,
    destination: "MV" as const,
    status: "visa_free" as const,
    maxStayDays: 30,
    documents: ["Pasport"],
    checkedAt: "2026-11-15",
    embassyPhone: "+960 123 4567",
  };
  await applyAdminOp(admin, visa, null);
  await applyAdminOp(admin, { ...visa, maxStayDays: 90 }, null);
  const rows = await db.select().from(visaRules).where(eq(visaRules.destination, "MV"));
  expect(rows.map((r) => [r.maxStayDays, r.embassyPhone, r.isSample])).toEqual([
    [90, "+960 123 4567", false],
  ]);

  // Partner offer: appears as a group option, request marked answered.
  await db.insert(agencyRequests).values({ tripId: trip.id, requestedBy: reporter, people: 4 });
  await applyAdminOp(
    admin,
    { op: "offer.add", tripId: trip.id, title: "Silk Way", detail: "4 kishilik", price: 590 },
    null,
  );
  const [offer] = await db
    .select()
    .from(tripOptions)
    .where(and(eq(tripOptions.tripId, trip.id), eq(tripOptions.kind, "offer")));
  expect([offer.title, offer.priceMinor]).toEqual(["Silk Way", 59000]);
  expect((await db.select().from(agencyRequests).where(eq(agencyRequests.tripId, trip.id)))[0].status).toBe(
    "answered",
  );

  const log = await db.select().from(auditLogs).where(eq(auditLogs.actorId, admin));
  expect(log.map((l) => l.action).sort()).toEqual(
    ["message.hide", "offer.add", "user.restore", "user.suspend", "visa.save", "visa.save"].sort(),
  );
  expect(log.find((l) => l.action === "user.suspend")?.ip).toBe("1.2.3.4");
});
