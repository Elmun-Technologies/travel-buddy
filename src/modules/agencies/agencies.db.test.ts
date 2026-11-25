// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { inArray } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { applyAdminOp } from "@/modules/admin/service";
import { loginWithTelegram, verifyPhoneFromTelegram } from "@/modules/auth/service";
import { getChat, listDirect } from "@/modules/chat/service";
import { requestJoin } from "@/modules/groups/service";
import { saveProfile } from "@/modules/profiles/service";
import { getTripView, listFeed } from "@/modules/trips/service";
import {
  agencyOf,
  agencyStats,
  closeOffer,
  createOffer,
  decideLead,
  getOffer,
  leadsCsv,
  listLeads,
  myLeadFor,
  registerAgency,
  submitLead,
  updateOffer,
  type OfferInput,
} from "./service";

const run = !!process.env.DATABASE_URL;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const base = Math.floor(Math.random() * 1e9) + 1.4e10;
const created: string[] = [];

async function newUser(n: number, phone = true) {
  const res = await loginWithTelegram({ id: base + n, first_name: `T${n}` }, "uz");
  if (!res.ok) throw new Error("login failed");
  created.push(res.userId);
  await saveProfile(res.userId, {
    displayName: `TEST ag ${n}`,
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
  if (phone)
    expect(await verifyPhoneFromTelegram(base + n, `+99898${String(base + n).slice(-7)}`)).toBe("ok");
  return res.userId;
}
const agencyInput = {
  name: "TEST Silk Way",
  legalName: null,
  taxId: null,
  phone: "+998901112233",
  website: null,
  description: null,
  country: "UZ",
  city: null,
};
const offer = (over: Partial<OfferInput> = {}): OfferInput => ({
  title: "TEST Georgia 6 days",
  destinationCountry: "GE",
  destinationCity: "Tbilisi",
  startDate: plusDays(30),
  endDate: plusDays(35),
  price: 550,
  currency: "USD",
  seats: 4,
  includes: ["Hotel", "Transfer"],
  excludes: ["Flight"],
  itinerary: [{ title: "Day 1", text: "Arrival" }],
  refundPolicy: "Full refund 14 days before",
  description: null,
  travelStyles: ["city"],
  ...over,
});

describe.runIf(run)("agencies, tours, leads, bookings (db)", () => {
  afterAll(async () => {
    const db = getDb();
    const mine = sql`(select id from agencies where name = 'TEST Silk Way')`;
    await db.execute(
      sql`delete from bookings where lead_id in (select id from leads where agency_id in ${mine})`,
    );
    await db.execute(sql`delete from leads where agency_id in ${mine}`);
    await db.execute(sql`delete from tour_offers where agency_id in ${mine}`);
    await db.execute(sql`delete from trips where agency_id in ${mine}`);
    await db.execute(sql`delete from agencies where name = 'TEST Silk Way'`);
    await db.delete(users).where(inArray(users.id, created));
  });

  it("register → verify → tour → request → accept (chat, phone) → book (seats) → cancel; CSV for commission", async () => {
    const [owner, admin, a, b, nophone] = [
      await newUser(1),
      await newUser(2),
      await newUser(3),
      await newUser(4),
      await newUser(5, false),
    ];
    // phone first; one agency per person
    expect(await registerAgency(nophone, agencyInput)).toEqual({ ok: false, error: "phone_required" });
    const reg = await registerAgency(owner, agencyInput);
    if (!reg.ok) throw new Error("register");
    expect(await registerAgency(owner, agencyInput)).toEqual({ ok: false, error: "already" });
    expect((await agencyOf(owner))?.agency.status).toBe("pending");

    // not verified: no tours yet
    expect(await createOffer(owner, offer())).toEqual({ ok: false, error: "not_verified" });
    expect(await createOffer(a, offer())).toEqual({ ok: false, error: "not_agency" });
    expect(await applyAdminOp(admin, { op: "agencyorg.verify", id: reg.id }, null)).toBe(true);

    const made = await createOffer(owner, offer());
    if (!made.ok) throw new Error("offer");
    const trip = await getTripView(made.id, a);
    expect(trip).toMatchObject({ kind: "agency", approvedCount: 0, groupSizeMax: 4, ownerUserId: null });
    expect((await listFeed(a, { page: 1, country: ["GE"] })).items.some((t) => t.id === made.id)).toBe(true);
    // group joining does not apply to agency tours
    expect(await requestJoin(a, made.id, null)).toEqual({ ok: false, error: "agency_trip" });
    expect((await getOffer(made.id))?.offer.seatsAvailable).toBe(4);

    // requests: phone needed; one active per person
    expect(await submitLead(nophone, made.id, null, 1)).toEqual({ ok: false, error: "phone_required" });
    const l1 = await submitLead(a, made.id, "Salom", 3);
    if (!l1.ok) throw new Error("lead");
    expect(await submitLead(a, made.id, null, 1)).toEqual({ ok: false, error: "already" });
    const l2 = await submitLead(b, made.id, null, 2);
    if (!l2.ok) throw new Error("lead 2");

    // the agency sees names but no phone until it accepts
    const inbox = await listLeads(reg.id);
    expect(inbox.find((l) => l.id === l1.id)).toMatchObject({ status: "new", phone: null, people: 3 });
    expect(await decideLead(a, l1.id, { op: "accept" })).toEqual({ ok: false, error: "forbidden" }); // not staff
    expect(await decideLead(owner, l1.id, { op: "accept" })).toEqual({ ok: true });
    const accepted = (await listLeads(reg.id)).find((l) => l.id === l1.id)!;
    expect(accepted.status).toBe("accepted");
    expect(accepted.phone).toMatch(/^\+998/);
    expect(accepted.conversationId).not.toBeNull();
    // the traveler and the agency can write to each other; a stranger cannot
    expect((await getChat(a, accepted.conversationId!))?.canWrite).toBe(true);
    expect(await getChat(owner, accepted.conversationId!)).not.toBeNull();
    expect(await getChat(b, accepted.conversationId!)).toBeNull();
    expect((await listDirect(a))[0]).toMatchObject({
      id: accepted.conversationId,
      kind: "lead",
      otherId: owner,
    });
    expect((await listDirect(owner))[0]).toMatchObject({ otherId: a });
    expect((await myLeadFor(a, made.id))?.conversationId).toBe(accepted.conversationId);

    // booking takes seats (3 of 4), too many for the rest is refused, the tour fills
    expect(await decideLead(owner, l1.id, { op: "book", amount: 1650 })).toEqual({ ok: true });
    expect((await getOffer(made.id))?.offer.seatsAvailable).toBe(1);
    expect((await getTripView(made.id, a))?.approvedCount).toBe(3);
    expect(await decideLead(owner, l2.id, { op: "accept" })).toEqual({ ok: true });
    expect(await decideLead(owner, l2.id, { op: "book", amount: 1100 })).toEqual({
      ok: false,
      error: "no_seats",
    });
    expect(await decideLead(owner, l2.id, { op: "reject" })).toEqual({ ok: false, error: "state" });

    // cancel gives the seats back
    expect(await decideLead(owner, l1.id, { op: "cancel" })).toEqual({ ok: true });
    expect((await getOffer(made.id))?.offer.seatsAvailable).toBe(4);
    expect(await decideLead(owner, l2.id, { op: "book", amount: 1100 })).toEqual({ ok: true });

    // stats and CSV
    expect(await agencyStats(reg.id)).toMatchObject({ offers: 1, leads: 2, bookings: 1, newLeads: 0 });
    const csv = await leadsCsv(plusDays(-1), plusDays(1));
    expect(csv.split("\n")[0]).toContain("agency,tour,lead_id");
    expect(csv).toContain("TEST Silk Way");
    expect(csv).toContain("1100.00");

    // editing: seats cannot go below the booked ones; closing hides the tour from requests
    expect(await updateOffer(owner, made.id, offer({ seats: 1 }))).toEqual({
      ok: false,
      error: "seats_below_booked",
    });
    expect(await updateOffer(owner, made.id, offer({ seats: 6, price: 600 }))).toEqual({
      ok: true,
      id: made.id,
    });
    expect((await getOffer(made.id))?.offer).toMatchObject({
      seatsTotal: 6,
      seatsAvailable: 4,
      price: 60000,
    });
    expect(await closeOffer(owner, made.id, true)).toBe(true);
    const third = await newUser(6);
    expect(await submitLead(third, made.id, null, 1)).toEqual({ ok: false, error: "closed" });
    // a suspended agency's tours disappear
    expect(await closeOffer(owner, made.id, false)).toBe(true);
    expect(await applyAdminOp(admin, { op: "agencyorg.suspend", id: reg.id }, null)).toBe(true);
    expect((await listFeed(third, { page: 1, country: ["GE"] })).items.some((t) => t.id === made.id)).toBe(
      false,
    );
  });
});
