import "server-only";
import {
  and,
  arrayOverlaps,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { travelIntents, trips } from "@/db/schema";
import { todayISO } from "@/lib/catalog";
import { type DbOrTx, getDb } from "@/lib/db";
import { createTripConversation } from "@/modules/chat/service";
import { visaFreeCountries } from "@/modules/destinations/service";
import { addOrganizer, countApproved, getMemberships } from "@/modules/groups/service";
import { getBlockedIds } from "@/modules/moderation/service";
import { getDisplayNames, getJoinProfile } from "@/modules/profiles/service";
import { getUserState } from "@/modules/users/service";
import type { FeedFilter, IntentInput, TripInput } from "./schema";

const PAGE_SIZE = 20;

const cardFields = {
  id: trips.id,
  kind: trips.kind,
  title: trips.title,
  destinationCountry: trips.destinationCountry,
  destinationCity: trips.destinationCity,
  startDate: trips.startDate,
  endDate: trips.endDate,
  budgetMin: trips.budgetMin,
  budgetMax: trips.budgetMax,
  currency: trips.currency,
  travelStyles: trips.travelStyles,
  groupSizeMax: trips.groupSizeMax,
  womenOnly: trips.womenOnly,
  status: trips.status,
  ownerUserId: trips.ownerUserId,
  isTest: trips.isTest,
  publicCode: trips.publicCode,
  datePrecision: trips.datePrecision,
};

async function withCounts<T extends { id: string; ownerUserId: string | null }>(rows: T[]) {
  const [counts, names] = await Promise.all([
    countApproved(rows.map((r) => r.id)),
    getDisplayNames(rows.flatMap((r) => (r.ownerUserId ? [r.ownerUserId] : []))),
  ]);
  return rows.map((r) => ({
    ...r,
    approvedCount: counts.get(r.id) ?? 0,
    ownerName: r.ownerUserId ? (names.get(r.ownerUserId) ?? null) : null,
  }));
}

export type CreateTripResult =
  | { ok: true; id: string; code: string }
  | { ok: false; error: "phone_required" | "profile_required" | "women_only_creator" };

export async function createTrip(userId: string, input: TripInput): Promise<CreateTripResult> {
  const db = getDb();
  const [state, profile] = await Promise.all([getUserState(db, userId), getJoinProfile(userId)]);
  if (!profile) return { ok: false, error: "profile_required" };
  if (!state?.phoneVerified) return { ok: false, error: "phone_required" };
  if (input.womenOnly && profile.gender !== "female") return { ok: false, error: "women_only_creator" };
  const t = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(trips)
      .values({
        ...input,
        kind: "independent",
        ownerUserId: userId,
        status: "open",
        isTest: isTestEnv(),
        publicCode: newPublicCode(),
      })
      .returning({ id: trips.id, publicCode: trips.publicCode });
    await addOrganizer(tx, row.id, userId);
    await createTripConversation(tx, row.id, userId);
    return row;
  });
  return { ok: true, id: t.id, code: t.publicCode! };
}

// 7 chars from 31 unambiguous symbols ≈ 2.7e10 codes: collisions are negligible at our scale
// (the unique index would reject one; the user just retries).
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export function newPublicCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(7));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export async function getTripIdByCode(code: string) {
  if (!/^[0-9A-Z]{6,8}$/.test(code)) return null;
  const [t] = await getDb().select({ id: trips.id }).from(trips).where(eq(trips.publicCode, code));
  return t?.id ?? null;
}

const isTestEnv = () => process.env.APP_ENV !== "production";

export async function listFeed(viewerId: string | null, f: FeedFilter) {
  const blocked = await getBlockedIds(viewerId);
  const conds = [
    inArray(trips.status, ["open", "full"]),
    eq(trips.visibility, "public"),
    gte(trips.startDate, todayISO()),
  ];
  if (f.country?.length) conds.push(inArray(trips.destinationCountry, f.country));
  if (f.date)
    conds.push(
      sql`${trips.startDate} - ${trips.dateFlexDays} <= ${f.date}::date`,
      sql`${trips.endDate} + ${trips.dateFlexDays} >= ${f.date}::date`,
    );
  if (f.month) {
    const [y, m] = f.month.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    conds.push(gte(trips.startDate, `${f.month}-01`), lt(trips.startDate, next));
  }
  // ponytail: budget filter ignores currency; add FX conversion when non-USD trips are common.
  if (f.budget) conds.push(or(isNull(trips.budgetMin), lte(trips.budgetMin, f.budget * 100))!);
  if (f.style?.length) conds.push(arrayOverlaps(trips.travelStyles, f.style));
  if (f.visa === "free")
    conds.push(inArray(trips.destinationCountry, [...(await visaFreeCountries()), "__none__"]));
  if (blocked.length) conds.push(or(isNull(trips.ownerUserId), notInArray(trips.ownerUserId, blocked))!);

  const where = and(...conds);
  const [rows, [{ total }]] = await Promise.all([
    getDb()
      .select(cardFields)
      .from(trips)
      .where(where)
      .orderBy(asc(trips.startDate), desc(trips.createdAt))
      .limit(PAGE_SIZE + 1)
      .offset((f.page - 1) * PAGE_SIZE),
    getDb().select({ total: count() }).from(trips).where(where),
  ]);
  return { items: await withCounts(rows.slice(0, PAGE_SIZE)), hasMore: rows.length > PAGE_SIZE, total };
}

/** Open groups closest to being full (home: "Yig'ilayotgan guruhlar"). */
export async function listForming(viewerId: string | null, limit = 3) {
  const { items } = await listFeed(viewerId, { page: 1 });
  return items
    .filter((t) => t.status === "open" && t.groupSizeMax)
    .map((t) => ({ ...t, fill: t.approvedCount / t.groupSizeMax! }))
    .sort((a, b) => b.fill - a.fill)
    .slice(0, limit);
}

/** Full trip for display, or null if hidden from this viewer. */
export async function getTripView(tripId: string, viewerId: string | null) {
  const [t] = await getDb().select().from(trips).where(eq(trips.id, tripId));
  if (!t) return null;
  const isOwner = !!viewerId && t.ownerUserId === viewerId;
  if (!isOwner && (t.status === "hidden" || t.status === "draft")) return null;
  if (viewerId && t.ownerUserId && (await getBlockedIds(viewerId)).includes(t.ownerUserId)) return null;
  const [withMeta] = await withCounts([t]);
  return { ...withMeta, isOwner };
}

export async function listMyTrips(userId: string) {
  const memberships = await getMemberships(userId);
  if (!memberships.size) return [];
  const rows = await getDb()
    .select(cardFields)
    .from(trips)
    .where(inArray(trips.id, [...memberships.keys()]))
    .orderBy(asc(trips.startDate));
  return (await withCounts(rows)).map((t) => ({ ...t, myStatus: memberships.get(t.id)! }));
}

export async function closeTrip(userId: string, tripId: string) {
  await getDb()
    .update(trips)
    .set({ status: "closed" })
    .where(and(eq(trips.id, tripId), eq(trips.ownerUserId, userId)));
}

export async function setTicketDeadline(tx: DbOrTx, tripId: string, day: string | null) {
  await tx.update(trips).set({ ticketDeadline: day }).where(eq(trips.id, tripId));
}

// ---- used by groups (inside its transactions) ----

export async function lockTripForJoin(tx: DbOrTx, tripId: string) {
  const [t] = await tx
    .select({
      ownerUserId: trips.ownerUserId,
      status: trips.status,
      startDate: trips.startDate,
      groupSizeMax: trips.groupSizeMax,
      ageMin: trips.ageMin,
      ageMax: trips.ageMax,
      womenOnly: trips.womenOnly,
      ticketDeadline: trips.ticketDeadline,
    })
    .from(trips)
    .where(eq(trips.id, tripId))
    .for("update");
  return t ?? null;
}

export async function setTripStatus(tx: DbOrTx, tripId: string, status: "open" | "full") {
  await tx.update(trips).set({ status }).where(eq(trips.id, tripId));
}

// ---- intents ("I want to go to X on these dates") ----

export async function createIntent(userId: string, input: IntentInput) {
  if (!(await getJoinProfile(userId))) return { ok: false as const, error: "profile_required" as const };
  await getDb()
    .insert(travelIntents)
    .values({ ...input, userId });
  return { ok: true as const };
}

export async function listMyIntents(userId: string) {
  return getDb()
    .select()
    .from(travelIntents)
    .where(
      and(
        eq(travelIntents.userId, userId),
        eq(travelIntents.status, "active"),
        gte(travelIntents.endDate, todayISO()),
      ),
    )
    .orderBy(asc(travelIntents.startDate));
}

export async function closeIntent(userId: string, intentId: string) {
  await getDb()
    .update(travelIntents)
    .set({ status: "closed" })
    .where(and(eq(travelIntents.id, intentId), eq(travelIntents.userId, userId)));
}

export type TripCard = Awaited<ReturnType<typeof listFeed>>["items"][number];
