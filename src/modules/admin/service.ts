import "server-only";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import {
  agencyRequests,
  auditLogs,
  authAccounts,
  conversations,
  messages,
  priceStats,
  reports,
  sessions,
  travelerProfiles,
  tripOptions,
  trips,
  users,
  visaAgencies,
  visaRules,
} from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";
import { emit } from "@/modules/chat/service";
import type { AdminOp } from "./schema";

// ponytail: the admin module reads and writes other modules' tables directly — it is the one place
// that sees everything; split into per-module "admin*" service functions if it grows.

const cents = (dollars: number) => Math.round(dollars * 100);

async function audit(tx: DbOrTx, actorId: string, op: AdminOp, targetId: string | null, ip: string | null) {
  const { op: action, ...meta } = op;
  await tx.insert(auditLogs).values({
    actorId,
    action,
    targetType: action.split(".")[0],
    targetId: targetId && /^[0-9a-f-]{36}$/.test(targetId) ? targetId : null,
    meta: meta as Record<string, unknown>,
    ip,
  });
}

async function closeReport(tx: DbOrTx, reportId: string | null | undefined, adminId: string) {
  if (!reportId) return;
  await tx
    .update(reports)
    .set({ status: "resolved", resolvedBy: adminId, resolvedAt: new Date() })
    .where(eq(reports.id, reportId));
}

/** Apply one admin change and audit it. Returns false if the target doesn't exist. */
export async function applyAdminOp(adminId: string, op: AdminOp, ip: string | null) {
  return getDb().transaction(async (tx) => {
    let target: string | null = null;
    switch (op.op) {
      case "report.close": {
        const r = await tx
          .update(reports)
          .set({ status: op.resolution, resolvedBy: adminId, resolvedAt: new Date() })
          .where(eq(reports.id, op.id))
          .returning({ id: reports.id });
        if (!r.length) return false;
        target = op.id;
        break;
      }
      case "message.hide": {
        const [m] = await tx
          .update(messages)
          .set({ hiddenAt: new Date() })
          .where(eq(messages.id, op.id))
          .returning({ c: messages.conversationId });
        if (!m) return false;
        await closeReport(tx, op.reportId, adminId);
        target = op.id;
        break;
      }
      case "trip.hide":
      case "trip.restore": {
        const r = await tx
          .update(trips)
          .set({ status: op.op === "trip.hide" ? "hidden" : "open" })
          .where(eq(trips.id, op.id))
          .returning({ id: trips.id });
        if (!r.length) return false;
        if (op.op === "trip.hide") await closeReport(tx, op.reportId, adminId);
        target = op.id;
        break;
      }
      case "user.suspend":
      case "user.restore": {
        const suspend = op.op === "user.suspend";
        const r = await tx
          .update(users)
          .set({ status: suspend ? "suspended" : "active" })
          .where(and(eq(users.id, op.id), inArray(users.status, suspend ? ["active"] : ["suspended"])))
          .returning({ id: users.id });
        if (!r.length) return false;
        if (suspend) {
          await tx.delete(sessions).where(eq(sessions.userId, op.id)); // logged out everywhere at once
          // their open trips disappear from the feed
          await tx
            .update(trips)
            .set({ status: "hidden" })
            .where(and(eq(trips.ownerUserId, op.id), inArray(trips.status, ["open", "full"])));
          await closeReport(tx, op.reportId, adminId);
        }
        target = op.id;
        break;
      }
      case "visa.save": {
        const { op: _, ...v } = op;
        await tx
          .insert(visaRules)
          .values({ ...v, documents: v.documents, isSample: false })
          .onConflictDoUpdate({
            target: [visaRules.passportCountry, visaRules.destination],
            set: { ...v, isSample: false },
          });
        break;
      }
      case "visa.delete":
        await tx.delete(visaRules).where(eq(visaRules.destination, op.destination));
        break;
      case "agency.save": {
        const values = {
          name: op.name,
          countries: op.countries,
          rating: op.rating ?? null,
          priceMinor: op.price == null ? null : cents(op.price),
          note: op.note ?? null,
          contactUrl: op.contactUrl ?? null,
          isSample: false,
        };
        if (op.id) {
          const r = await tx.update(visaAgencies).set(values).where(eq(visaAgencies.id, op.id)).returning();
          if (!r.length) return false;
          target = op.id;
        } else
          target = (await tx.insert(visaAgencies).values(values).returning({ id: visaAgencies.id }))[0].id;
        break;
      }
      case "agency.delete":
        await tx.delete(visaAgencies).where(eq(visaAgencies.id, op.id));
        target = op.id;
        break;
      case "price.save": {
        const values = {
          destination: op.destination,
          days: op.days,
          roomType: op.roomType,
          p25: cents(op.p25),
          median: cents(op.median),
          p75: cents(op.p75),
          sampleSize: op.sampleSize,
          items: op.items.map((i) => ({ key: i.key, amount: cents(i.amount) })),
          isSample: false,
        };
        await tx
          .insert(priceStats)
          .values(values)
          .onConflictDoUpdate({
            target: [priceStats.destination, priceStats.days, priceStats.roomType],
            set: values,
          });
        break;
      }
      case "price.delete":
        await tx.delete(priceStats).where(eq(priceStats.id, op.id));
        target = op.id;
        break;
      case "request.status": {
        const r = await tx
          .update(agencyRequests)
          .set({ status: op.status })
          .where(eq(agencyRequests.id, op.id))
          .returning({ id: agencyRequests.id });
        if (!r.length) return false;
        target = op.id;
        break;
      }
      case "offer.add": {
        const [o] = await tx
          .insert(tripOptions)
          .values({
            tripId: op.tripId,
            kind: "offer",
            title: op.title,
            detail: op.detail ?? null,
            priceMinor: cents(op.price),
          })
          .returning({ id: tripOptions.id });
        await tx
          .update(agencyRequests)
          .set({ status: "answered" })
          .where(eq(agencyRequests.tripId, op.tripId));
        await notifyBoard(tx, op.tripId);
        target = o.id;
        break;
      }
      case "offer.remove": {
        const [o] = await tx
          .delete(tripOptions)
          .where(and(eq(tripOptions.id, op.id), eq(tripOptions.kind, "offer")))
          .returning({ tripId: tripOptions.tripId });
        if (!o) return false;
        await notifyBoard(tx, o.tripId);
        target = op.id;
        break;
      }
    }
    await audit(tx, adminId, op, target, ip);
    return true;
  });
}

/** Open room pages refresh their Yig'amiz tab. */
async function notifyBoard(tx: DbOrTx, tripId: string) {
  const [c] = await tx
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.tripId, tripId), eq(conversations.kind, "trip_group")));
  if (c) await emit(tx, { t: "board", c: c.id });
}

// ---------- reads ----------

export async function adminCounts() {
  const db = getDb();
  const one = async (q: Promise<{ n: number }[]>) => (await q)[0].n;
  const [usersN, openTrips, openReports, newRequests] = await Promise.all([
    one(db.select({ n: count() }).from(users).where(isNull(users.deletedAt))),
    one(
      db
        .select({ n: count() })
        .from(trips)
        .where(and(inArray(trips.status, ["open", "full"]), eq(trips.isTest, false))),
    ),
    one(db.select({ n: count() }).from(reports).where(eq(reports.status, "open"))),
    one(db.select({ n: count() }).from(agencyRequests).where(eq(agencyRequests.status, "new"))),
  ]);
  return { users: usersN, openTrips, openReports, newRequests };
}

/** Open reports with enough context to decide without leaving the page. */
export async function listOpenReports() {
  const db = getDb();
  const rows = await db
    .select({
      id: reports.id,
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      createdAt: reports.createdAt,
      reporter: travelerProfiles.displayName,
    })
    .from(reports)
    .leftJoin(travelerProfiles, eq(travelerProfiles.userId, reports.reporterId))
    .where(eq(reports.status, "open"))
    .orderBy(sql`case when ${reports.reason} in ('dating', 'unsafe') then 0 else 1 end`, reports.createdAt)
    .limit(100);
  const ids = (t: string) => rows.filter((r) => r.targetType === t).map((r) => r.targetId);
  const [msgs, tripRows, people] = await Promise.all([
    ids("message").length
      ? db
          .select({
            id: messages.id,
            body: messages.body,
            senderId: messages.senderId,
            hiddenAt: messages.hiddenAt,
          })
          .from(messages)
          .where(inArray(messages.id, ids("message")))
      : [],
    ids("trip").length
      ? db
          .select({ id: trips.id, title: trips.title, ownerUserId: trips.ownerUserId, status: trips.status })
          .from(trips)
          .where(inArray(trips.id, ids("trip")))
      : [],
    ids("user").length
      ? db
          .select({ id: travelerProfiles.userId, name: travelerProfiles.displayName })
          .from(travelerProfiles)
          .where(inArray(travelerProfiles.userId, ids("user")))
      : [],
  ]);
  return rows.map((r) => {
    const m = msgs.find((x) => x.id === r.targetId);
    const t = tripRows.find((x) => x.id === r.targetId);
    const u = people.find((x) => x.id === r.targetId);
    return {
      ...r,
      createdAt: r.createdAt.toISOString(),
      text: m?.body ?? t?.title ?? u?.name ?? null,
      hidden: m ? !!m.hiddenAt : t ? t.status === "hidden" : false,
      // who to suspend for this report
      authorId: m?.senderId ?? t?.ownerUserId ?? (u ? r.targetId : null),
    };
  });
}

export async function searchUsers(q: string) {
  const term = `%${q.trim()}%`;
  return getDb()
    .select({
      id: users.id,
      status: users.status,
      role: users.role,
      phoneVerified: users.phoneVerified,
      createdAt: users.createdAt,
      name: travelerProfiles.displayName,
      telegramId: authAccounts.providerUserId,
    })
    .from(users)
    .leftJoin(travelerProfiles, eq(travelerProfiles.userId, users.id))
    .leftJoin(authAccounts, and(eq(authAccounts.userId, users.id), eq(authAccounts.provider, "telegram")))
    .where(
      and(
        isNull(users.deletedAt),
        q.trim()
          ? or(ilike(travelerProfiles.displayName, term), eq(authAccounts.providerUserId, q.trim()))
          : undefined,
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(50);
}

export async function searchTrips(q: string) {
  const term = `%${q.trim()}%`;
  return getDb()
    .select({
      id: trips.id,
      title: trips.title,
      country: trips.destinationCountry,
      startDate: trips.startDate,
      status: trips.status,
      isTest: trips.isTest,
      owner: travelerProfiles.displayName,
    })
    .from(trips)
    .leftJoin(travelerProfiles, eq(travelerProfiles.userId, trips.ownerUserId))
    .where(q.trim() ? or(ilike(trips.title, term), eq(trips.publicCode, q.trim().toUpperCase())) : undefined)
    .orderBy(desc(trips.createdAt))
    .limit(50);
}

export async function listAgencyRequests() {
  const db = getDb();
  const rows = await db
    .select({
      id: agencyRequests.id,
      status: agencyRequests.status,
      people: agencyRequests.people,
      createdAt: agencyRequests.createdAt,
      tripId: trips.id,
      title: trips.title,
      country: trips.destinationCountry,
      startDate: trips.startDate,
      endDate: trips.endDate,
      budgetMin: trips.budgetMin,
      budgetMax: trips.budgetMax,
      styles: trips.travelStyles,
    })
    .from(agencyRequests)
    .innerJoin(trips, eq(trips.id, agencyRequests.tripId))
    .orderBy(
      sql`case ${agencyRequests.status} when 'new' then 0 when 'sent' then 1 else 2 end`,
      desc(agencyRequests.createdAt),
    )
    .limit(100);
  const offers = rows.length
    ? await db
        .select({
          id: tripOptions.id,
          tripId: tripOptions.tripId,
          title: tripOptions.title,
          detail: tripOptions.detail,
          price: tripOptions.priceMinor,
        })
        .from(tripOptions)
        .where(
          and(
            eq(tripOptions.kind, "offer"),
            inArray(
              tripOptions.tripId,
              rows.map((r) => r.tripId),
            ),
          ),
        )
    : [];
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    offers: offers.filter((o) => o.tripId === r.tripId),
  }));
}

export const listAllVisaRules = () => getDb().select().from(visaRules).orderBy(visaRules.destination);
export const listAllAgencies = () => getDb().select().from(visaAgencies).orderBy(visaAgencies.name);
export const listAllPrices = () =>
  getDb().select().from(priceStats).orderBy(priceStats.destination, priceStats.days, priceStats.roomType);

export async function listAudit() {
  return getDb()
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      targetId: auditLogs.targetId,
      meta: auditLogs.meta,
      createdAt: auditLogs.createdAt,
      actor: travelerProfiles.displayName,
    })
    .from(auditLogs)
    .leftJoin(travelerProfiles, eq(travelerProfiles.userId, auditLogs.actorId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);
}
