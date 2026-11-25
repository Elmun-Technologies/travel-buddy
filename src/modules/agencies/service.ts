import "server-only";
import { and, asc, count, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import {
  agencies,
  agencyMembers,
  agencyVerifications,
  bookings,
  conversationMembers,
  conversations,
  leads,
  tourOffers,
  trips,
  users,
} from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";
import { notify } from "@/modules/notifications/service";
import { getDisplayNames } from "@/modules/profiles/service";
import { getUserState } from "@/modules/users/service";
import { newPublicCode } from "@/modules/trips/service";

// Agencies: registered and verified by hand, they publish tours; travelers leave a request (lead);
// the agency accepts it, talks to the person in a private chat, and marks the booking.
// No money passes through us. Leads and bookings are recorded for later commission billing.

export type AgencyInput = {
  name: string;
  legalName: string | null;
  taxId: string | null;
  phone: string;
  website: string | null;
  description: string | null;
  country: string | null;
  city: string | null;
};

const slugOf = (name: string) =>
  `${
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30) || "agency"
  }-${crypto.randomUUID().slice(0, 6)}`;

/** The agency this person works for (one per person), with their role. */
export async function agencyOf(userId: string) {
  const [row] = await getDb()
    .select({ agency: agencies, role: agencyMembers.role })
    .from(agencyMembers)
    .innerJoin(agencies, eq(agencies.id, agencyMembers.agencyId))
    .where(eq(agencyMembers.userId, userId))
    .limit(1);
  return row ?? null;
}

export async function registerAgency(userId: string, input: AgencyInput) {
  const state = await getUserState(getDb(), userId);
  if (!state?.phoneVerified) return { ok: false as const, error: "phone_required" as const };
  if (await agencyOf(userId)) return { ok: false as const, error: "already" as const };
  return getDb().transaction(async (tx) => {
    const [a] = await tx
      .insert(agencies)
      .values({ ...input, slug: slugOf(input.name), status: "pending" })
      .returning({ id: agencies.id });
    await tx.insert(agencyMembers).values({ agencyId: a.id, userId, role: "owner" });
    await tx.insert(agencyVerifications).values({ agencyId: a.id, documentKeys: [], status: "pending" });
    return { ok: true as const, id: a.id };
  });
}

export const MAX_AGENCY_DOCS = 6;

/** Papers for the check (licence, registration) — stored privately; only admins read them. */
export async function addAgencyDocs(agencyId: string, keys: string[]) {
  const [v] = await getDb()
    .select()
    .from(agencyVerifications)
    .where(and(eq(agencyVerifications.agencyId, agencyId), eq(agencyVerifications.status, "pending")))
    .orderBy(desc(agencyVerifications.createdAt))
    .limit(1);
  const current = v?.documentKeys ?? [];
  if (current.length + keys.length > MAX_AGENCY_DOCS) return false;
  if (v)
    await getDb()
      .update(agencyVerifications)
      .set({ documentKeys: [...current, ...keys] })
      .where(eq(agencyVerifications.id, v.id));
  else await getDb().insert(agencyVerifications).values({ agencyId, documentKeys: keys, status: "pending" });
  return true;
}

export async function agencyDocCount(agencyId: string) {
  const rows = await getDb()
    .select({ keys: agencyVerifications.documentKeys })
    .from(agencyVerifications)
    .where(eq(agencyVerifications.agencyId, agencyId));
  return rows.reduce((n, r) => n + (r.keys?.length ?? 0), 0);
}

export async function agencyDocKey(agencyId: string, index: number) {
  const rows = await getDb()
    .select({ keys: agencyVerifications.documentKeys })
    .from(agencyVerifications)
    .where(eq(agencyVerifications.agencyId, agencyId))
    .orderBy(asc(agencyVerifications.createdAt));
  return rows.flatMap((r) => r.keys ?? [])[index] ?? null;
}

export async function listAgenciesForAdmin() {
  const rows = await getDb()
    .select()
    .from(agencies)
    .orderBy(
      sql`case ${agencies.status} when 'pending' then 0 when 'verified' then 1 else 2 end`,
      desc(agencies.createdAt),
    )
    .limit(100);
  const docs = new Map<string, number>();
  for (const r of rows) docs.set(r.id, await agencyDocCount(r.id));
  return rows.map((r) => ({ ...r, docs: docs.get(r.id) ?? 0 }));
}

/** Admin decision, inside the admin op's transaction. */
export async function decideAgency(
  tx: DbOrTx,
  adminId: string,
  agencyId: string,
  status: "verified" | "suspended",
) {
  const r = await tx
    .update(agencies)
    .set({ status })
    .where(eq(agencies.id, agencyId))
    .returning({ id: agencies.id });
  if (!r.length) return false;
  await tx
    .update(agencyVerifications)
    .set({
      status: status === "verified" ? "approved" : "rejected",
      reviewedBy: adminId,
      reviewedAt: new Date(),
    })
    .where(and(eq(agencyVerifications.agencyId, agencyId), eq(agencyVerifications.status, "pending")));
  if (status === "suspended")
    // a suspended agency's tours leave the feed at once
    await tx
      .update(trips)
      .set({ status: "hidden" })
      .where(and(eq(trips.agencyId, agencyId), inArray(trips.status, ["open", "full"])));
  return true;
}

// ---------- tour offers ----------

export type OfferInput = {
  title: string;
  destinationCountry: string;
  destinationCity: string | null;
  startDate: string;
  endDate: string;
  price: number; // dollars per person
  currency: string;
  seats: number;
  includes: string[];
  excludes: string[];
  itinerary: { title: string; text: string }[];
  refundPolicy: string | null;
  description: string | null;
  travelStyles: string[];
};

export type OfferResult =
  | { ok: true; id: string }
  | { ok: false; error: "not_agency" | "not_verified" | "not_found" | "seats_below_booked" };

async function myVerifiedAgency(userId: string) {
  const a = await agencyOf(userId);
  if (!a) return { error: "not_agency" as const };
  if (a.agency.status !== "verified") return { error: "not_verified" as const };
  return { agency: a.agency };
}

export async function createOffer(userId: string, input: OfferInput): Promise<OfferResult> {
  const mine = await myVerifiedAgency(userId);
  if (!mine.agency) return { ok: false, error: mine.error ?? "not_agency" };
  return getDb().transaction(async (tx) => {
    const [t] = await tx
      .insert(trips)
      .values({
        kind: "agency",
        agencyId: mine.agency.id,
        ownerUserId: null,
        title: input.title,
        destinationCountry: input.destinationCountry,
        destinationCity: input.destinationCity,
        startDate: input.startDate,
        endDate: input.endDate,
        budgetMin: input.price * 100,
        budgetMax: input.price * 100,
        currency: input.currency,
        travelStyles: input.travelStyles,
        groupSizeMax: input.seats,
        description: input.description,
        status: "open",
        isTest: process.env.APP_ENV !== "production",
        publicCode: newPublicCode(),
      })
      .returning({ id: trips.id });
    await tx.insert(tourOffers).values({
      tripId: t.id,
      agencyId: mine.agency.id,
      price: input.price * 100,
      currency: input.currency,
      includes: input.includes,
      excludes: input.excludes,
      itinerary: input.itinerary,
      refundPolicy: input.refundPolicy,
      seatsTotal: input.seats,
      seatsAvailable: input.seats,
    });
    return { ok: true, id: t.id };
  });
}

export async function updateOffer(userId: string, tripId: string, input: OfferInput): Promise<OfferResult> {
  const mine = await myVerifiedAgency(userId);
  if (!mine.agency) return { ok: false, error: mine.error ?? "not_agency" };
  return getDb().transaction(async (tx) => {
    const [o] = await tx
      .select()
      .from(tourOffers)
      .where(and(eq(tourOffers.tripId, tripId), eq(tourOffers.agencyId, mine.agency.id)))
      .for("update");
    if (!o) return { ok: false, error: "not_found" };
    const booked = o.seatsTotal - o.seatsAvailable;
    if (input.seats < booked) return { ok: false, error: "seats_below_booked" };
    await tx
      .update(tourOffers)
      .set({
        price: input.price * 100,
        currency: input.currency,
        includes: input.includes,
        excludes: input.excludes,
        itinerary: input.itinerary,
        refundPolicy: input.refundPolicy,
        seatsTotal: input.seats,
        seatsAvailable: input.seats - booked,
      })
      .where(eq(tourOffers.id, o.id));
    await tx
      .update(trips)
      .set({
        title: input.title,
        destinationCountry: input.destinationCountry,
        destinationCity: input.destinationCity,
        startDate: input.startDate,
        endDate: input.endDate,
        budgetMin: input.price * 100,
        budgetMax: input.price * 100,
        currency: input.currency,
        travelStyles: input.travelStyles,
        groupSizeMax: input.seats,
        description: input.description,
        status:
          input.seats - booked <= 0
            ? "full"
            : sql`case when ${trips.status} = 'full' then 'open'::trip_status else ${trips.status} end`,
      })
      .where(eq(trips.id, tripId));
    return { ok: true, id: tripId };
  });
}

export async function closeOffer(userId: string, tripId: string, close: boolean) {
  const a = await agencyOf(userId);
  if (!a) return false;
  const r = await getDb()
    .update(trips)
    .set({ status: close ? "closed" : "open" })
    .where(
      and(
        eq(trips.id, tripId),
        eq(trips.agencyId, a.agency.id),
        inArray(trips.status, close ? ["open", "full"] : ["closed"]),
      ),
    )
    .returning({ id: trips.id });
  return r.length > 0;
}

/** Everything the public tour page shows beyond the common trip fields. */
export async function getOffer(tripId: string) {
  const [row] = await getDb()
    .select({
      offer: tourOffers,
      agencyName: agencies.name,
      agencyStatus: agencies.status,
      agencyId: agencies.id,
      website: agencies.website,
    })
    .from(tourOffers)
    .innerJoin(agencies, eq(agencies.id, tourOffers.agencyId))
    .where(eq(tourOffers.tripId, tripId));
  return row ?? null;
}

export async function bumpViews(tripId: string) {
  await getDb()
    .update(tourOffers)
    .set({ views: sql`${tourOffers.views} + 1` })
    .where(eq(tourOffers.tripId, tripId));
}

/** trip id → seats already taken (for the "7/10" bar of agency tours). */
export async function seatsTaken(tripIds: string[]) {
  if (!tripIds.length) return new Map<string, number>();
  const rows = await getDb()
    .select({
      tripId: tourOffers.tripId,
      taken: sql<number>`${tourOffers.seatsTotal} - ${tourOffers.seatsAvailable}`,
    })
    .from(tourOffers)
    .where(inArray(tourOffers.tripId, tripIds));
  return new Map(rows.map((r) => [r.tripId, Number(r.taken)]));
}

export async function listOffers(agencyId: string) {
  return getDb()
    .select({
      id: trips.id,
      title: trips.title,
      status: trips.status,
      start: trips.startDate,
      end: trips.endDate,
      seatsTotal: tourOffers.seatsTotal,
      seatsAvailable: tourOffers.seatsAvailable,
      price: tourOffers.price,
      currency: tourOffers.currency,
      views: tourOffers.views,
      leads: sql<number>`(select count(*)::int from leads l where l.tour_offer_id = ${tourOffers.id})`,
    })
    .from(tourOffers)
    .innerJoin(trips, eq(trips.id, tourOffers.tripId))
    .where(eq(tourOffers.agencyId, agencyId))
    .orderBy(desc(trips.startDate));
}

export async function getOfferForEdit(userId: string, tripId: string) {
  const a = await agencyOf(userId);
  if (!a) return null;
  const [row] = await getDb()
    .select({ trip: trips, offer: tourOffers })
    .from(tourOffers)
    .innerJoin(trips, eq(trips.id, tourOffers.tripId))
    .where(and(eq(tourOffers.tripId, tripId), eq(tourOffers.agencyId, a.agency.id)));
  return row ?? null;
}

// ---------- leads ----------

export type LeadResult =
  | { ok: true; id: string }
  | { ok: false; error: "not_found" | "phone_required" | "profile_required" | "already" | "closed" };

/** "Ariza qoldirish": the traveler asks the agency for seats. One active request per tour. */
export async function submitLead(
  userId: string,
  tripId: string,
  message: string | null,
  people: number,
): Promise<LeadResult> {
  const state = await getUserState(getDb(), userId);
  if (!state?.phoneVerified) return { ok: false, error: "phone_required" };
  return getDb().transaction(async (tx) => {
    const [o] = await tx
      .select({ offer: tourOffers, status: trips.status, title: trips.title, agencyStatus: agencies.status })
      .from(tourOffers)
      .innerJoin(trips, eq(trips.id, tourOffers.tripId))
      .innerJoin(agencies, eq(agencies.id, tourOffers.agencyId))
      .where(eq(tourOffers.tripId, tripId))
      .for("update", { of: tourOffers });
    if (!o || o.agencyStatus !== "verified") return { ok: false, error: "not_found" };
    if (o.status !== "open" || o.offer.seatsAvailable < 1) return { ok: false, error: "closed" };
    const [active] = await tx
      .select({ id: leads.id })
      .from(leads)
      .where(
        and(
          eq(leads.tourOfferId, o.offer.id),
          eq(leads.userId, userId),
          inArray(leads.status, ["new", "accepted", "booked"]),
        ),
      );
    if (active) return { ok: false, error: "already" };
    const [l] = await tx
      .insert(leads)
      .values({
        tourOfferId: o.offer.id,
        agencyId: o.offer.agencyId,
        userId,
        message,
        people: Math.min(people, o.offer.seatsAvailable),
      })
      .returning({ id: leads.id });
    const staff = await tx
      .select({ id: agencyMembers.userId })
      .from(agencyMembers)
      .where(eq(agencyMembers.agencyId, o.offer.agencyId));
    for (const s of staff) await notify(tx, s.id, "lead_new", { text: o.title, memberId: userId });
    return { ok: true, id: l.id };
  });
}

/** The traveler's own request for a tour, if any (latest first). */
export async function myLeadFor(userId: string, tripId: string) {
  const [row] = await getDb()
    .select({ id: leads.id, status: leads.status, people: leads.people })
    .from(leads)
    .innerJoin(tourOffers, eq(tourOffers.id, leads.tourOfferId))
    .where(and(eq(tourOffers.tripId, tripId), eq(leads.userId, userId)))
    .orderBy(desc(leads.createdAt))
    .limit(1);
  if (!row) return null;
  const [c] = await getDb()
    .select({ id: conversations.id })
    .from(conversations)
    .where(eq(conversations.leadId, row.id));
  return { ...row, conversationId: c?.id ?? null };
}

/** Agency inbox. The phone number appears only after the agency accepted the request. */
export async function listLeads(agencyId: string) {
  const rows = await getDb()
    .select({
      id: leads.id,
      userId: leads.userId,
      status: leads.status,
      message: leads.message,
      people: leads.people,
      createdAt: leads.createdAt,
      tripId: tourOffers.tripId,
      tripTitle: trips.title,
      phone: users.phone,
      amount: bookings.amount,
      currency: bookings.currency,
    })
    .from(leads)
    .innerJoin(tourOffers, eq(tourOffers.id, leads.tourOfferId))
    .innerJoin(trips, eq(trips.id, tourOffers.tripId))
    .innerJoin(users, eq(users.id, leads.userId))
    .leftJoin(bookings, eq(bookings.leadId, leads.id))
    .where(eq(leads.agencyId, agencyId))
    .orderBy(
      sql`case ${leads.status} when 'new' then 0 when 'accepted' then 1 else 2 end`,
      desc(leads.createdAt),
    )
    .limit(200);
  const names = await getDisplayNames(rows.map((r) => r.userId));
  const convs = rows.length
    ? await getDb()
        .select({ id: conversations.id, leadId: conversations.leadId })
        .from(conversations)
        .where(
          inArray(
            conversations.leadId,
            rows.map((r) => r.id),
          ),
        )
    : [];
  const conv = new Map(convs.map((c) => [c.leadId, c.id]));
  return rows.map((r) => ({
    ...r,
    name: names.get(r.userId) ?? "—",
    phone: r.status === "accepted" || r.status === "booked" ? r.phone : null,
    conversationId: conv.get(r.id) ?? null,
  }));
}

export type LeadOp =
  | { op: "accept" }
  | { op: "reject" }
  | { op: "book"; amount: number } // total in dollars
  | { op: "cancel" };

/**
 * An agency member handles one request. accept → private chat opens and the phone is shown;
 * book → the seats are taken and a booking is recorded (basis for commission); cancel gives them back.
 */
export async function decideLead(userId: string, leadId: string, action: LeadOp) {
  const a = await agencyOf(userId);
  if (!a || a.agency.status !== "verified") return { ok: false as const, error: "forbidden" as const };
  return getDb().transaction(async (tx) => {
    const [l] = await tx
      .select({ lead: leads, offer: tourOffers, title: trips.title, tripId: trips.id })
      .from(leads)
      .innerJoin(tourOffers, eq(tourOffers.id, leads.tourOfferId))
      .innerJoin(trips, eq(trips.id, tourOffers.tripId))
      .where(and(eq(leads.id, leadId), eq(leads.agencyId, a.agency.id)))
      .for("update", { of: [leads, tourOffers] });
    if (!l) return { ok: false as const, error: "not_found" as const };
    const now = new Date();
    switch (action.op) {
      case "accept": {
        if (l.lead.status !== "new") return { ok: false as const, error: "state" as const };
        await tx.update(leads).set({ status: "accepted", acceptedAt: now }).where(eq(leads.id, leadId));
        const [c] = await tx
          .insert(conversations)
          .values({ kind: "lead", leadId })
          .returning({ id: conversations.id });
        const staff = await tx
          .select({ id: agencyMembers.userId })
          .from(agencyMembers)
          .where(eq(agencyMembers.agencyId, a.agency.id));
        // the traveler first: the chat list shows each side the other
        await tx
          .insert(conversationMembers)
          .values([
            { conversationId: c.id, userId: l.lead.userId },
            ...staff.map((s) => ({ conversationId: c.id, userId: s.id })),
          ]);
        await notify(tx, l.lead.userId, "lead_accepted", { text: l.title, convId: c.id });
        return { ok: true as const };
      }
      case "reject": {
        if (l.lead.status !== "new") return { ok: false as const, error: "state" as const };
        await tx.update(leads).set({ status: "rejected", rejectedAt: now }).where(eq(leads.id, leadId));
        await notify(tx, l.lead.userId, "lead_rejected", { text: l.title });
        return { ok: true as const };
      }
      case "book": {
        if (l.lead.status !== "accepted") return { ok: false as const, error: "state" as const };
        if (l.offer.seatsAvailable < l.lead.people) return { ok: false as const, error: "no_seats" as const };
        await tx.update(leads).set({ status: "booked", bookedAt: now }).where(eq(leads.id, leadId));
        await tx.insert(bookings).values({
          leadId,
          people: l.lead.people,
          amount: Math.round(action.amount * 100),
          currency: l.offer.currency,
          status: "confirmed",
          confirmedAt: now,
        });
        const left = l.offer.seatsAvailable - l.lead.people;
        await tx.update(tourOffers).set({ seatsAvailable: left }).where(eq(tourOffers.id, l.offer.id));
        if (left <= 0) await tx.update(trips).set({ status: "full" }).where(eq(trips.id, l.tripId));
        return { ok: true as const };
      }
      case "cancel": {
        if (l.lead.status !== "accepted" && l.lead.status !== "booked")
          return { ok: false as const, error: "state" as const };
        if (l.lead.status === "booked") {
          await tx.update(bookings).set({ status: "cancelled" }).where(eq(bookings.leadId, leadId));
          await tx
            .update(tourOffers)
            .set({
              seatsAvailable: sql`least(${tourOffers.seatsTotal}, ${tourOffers.seatsAvailable} + ${l.lead.people})`,
            })
            .where(eq(tourOffers.id, l.offer.id));
          await tx
            .update(trips)
            .set({
              status: sql`case when ${trips.status} = 'full' then 'open'::trip_status else ${trips.status} end`,
            })
            .where(eq(trips.id, l.tripId));
        }
        await tx.update(leads).set({ status: "cancelled", cancelledAt: now }).where(eq(leads.id, leadId));
        return { ok: true as const };
      }
    }
  });
}

/** Numbers for the agency dashboard. */
export async function agencyStats(agencyId: string) {
  const [o] = await getDb()
    .select({
      offers: count(),
      views: sql<number>`coalesce(sum(${tourOffers.views}), 0)::int`,
      seats: sql<number>`coalesce(sum(${tourOffers.seatsTotal}), 0)::int`,
      taken: sql<number>`coalesce(sum(${tourOffers.seatsTotal} - ${tourOffers.seatsAvailable}), 0)::int`,
    })
    .from(tourOffers)
    .where(eq(tourOffers.agencyId, agencyId));
  const [l] = await getDb()
    .select({
      total: count(),
      fresh: sql<number>`count(*) filter (where ${leads.status} = 'new')::int`,
      booked: sql<number>`count(*) filter (where ${leads.status} = 'booked')::int`,
    })
    .from(leads)
    .where(eq(leads.agencyId, agencyId));
  return {
    offers: o.offers,
    views: o.views,
    leads: l.total,
    newLeads: l.fresh,
    bookings: l.booked,
    fill: o.seats ? Math.round((o.taken / o.seats) * 100) : 0,
  };
}

const csv = (v: unknown) => {
  const s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  // spreadsheet formula injection: a leading = + - @ is neutralised
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** All requests and bookings in a period, as CSV — the basis for commission invoices. Admin only. */
export async function leadsCsv(from: string, to: string) {
  const rows = await getDb()
    .select({
      agency: agencies.name,
      tour: trips.title,
      leadId: leads.id,
      status: leads.status,
      people: leads.people,
      requestedAt: leads.createdAt,
      acceptedAt: leads.acceptedAt,
      bookedAt: leads.bookedAt,
      amount: bookings.amount,
      currency: bookings.currency,
      bookingStatus: bookings.status,
    })
    .from(leads)
    .innerJoin(agencies, eq(agencies.id, leads.agencyId))
    .innerJoin(tourOffers, eq(tourOffers.id, leads.tourOfferId))
    .innerJoin(trips, eq(trips.id, tourOffers.tripId))
    .leftJoin(bookings, eq(bookings.leadId, leads.id))
    .where(
      and(
        sql`${leads.createdAt} >= ${from}::date`,
        sql`${leads.createdAt} < (${to}::date + 1)`,
        isNotNull(leads.id),
      ),
    )
    .orderBy(desc(leads.createdAt));
  const head = [
    "agency",
    "tour",
    "lead_id",
    "status",
    "people",
    "requested_at",
    "accepted_at",
    "booked_at",
    "amount",
    "currency",
    "booking_status",
  ];
  return [
    head.join(","),
    ...rows.map((r) =>
      [
        r.agency,
        r.tour,
        r.leadId,
        r.status,
        r.people,
        r.requestedAt,
        r.acceptedAt,
        r.bookedAt,
        r.amount == null ? "" : (r.amount / 100).toFixed(2),
        r.currency,
        r.bookingStatus,
      ]
        .map(csv)
        .join(","),
    ),
  ].join("\n");
}
