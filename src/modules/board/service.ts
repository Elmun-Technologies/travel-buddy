import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import {
  agencyRequests,
  checklistItems,
  expenses,
  optionVotes,
  planItems,
  settlements,
  tripOptions,
  tripTickets,
} from "@/db/schema";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { getDb } from "@/lib/db";
import { emit } from "@/modules/chat/service";
import { listMembers } from "@/modules/groups/service";
import { setTicketDeadline } from "@/modules/trips/service";
import { type BoardOp, toMinor } from "./schema";
import { settle } from "./settle";

export const DEFAULT_CHECKLIST = ["passport", "ticket", "insurance", "cash", "clothes"] as const;

type Kind = "flight" | "stay" | "offer";

/** Approved members (organizer included) with names; null if the viewer is not one of them. */
async function members(viewerId: string, tripId: string) {
  const rows = await listMembers(viewerId, tripId);
  return rows
    ?.filter((r) => r.status === "approved")
    .map((r) => ({ id: r.userId, name: r.name, role: r.role }));
}

/** Everything the Reja / Yig'amiz / Xarajat tabs show, for one member. */
export async function getBoard(tripId: string, viewerId: string) {
  const people = await members(viewerId, tripId);
  if (!people) return null;
  const db = getDb();

  // First visit: the default checklist (labels translated in the UI).
  await db
    .insert(checklistItems)
    .values(DEFAULT_CHECKLIST.map((k) => ({ tripId, userId: viewerId, label: `k:${k}` })))
    .onConflictDoNothing();
  // ponytail: re-inserting is a no-op thanks to the unique index; a deleted default comes back on
  // the next visit, so "remove" is offered only for the member's own items.

  const [plan, checks, options, votes, tickets, exps, pays, request] = await Promise.all([
    db
      .select()
      .from(planItems)
      .where(eq(planItems.tripId, tripId))
      .orderBy(asc(planItems.day), asc(planItems.createdAt)),
    db
      .select({
        userId: checklistItems.userId,
        id: checklistItems.id,
        label: checklistItems.label,
        done: checklistItems.done,
      })
      .from(checklistItems)
      .where(eq(checklistItems.tripId, tripId))
      .orderBy(asc(checklistItems.createdAt)),
    db.select().from(tripOptions).where(eq(tripOptions.tripId, tripId)).orderBy(asc(tripOptions.createdAt)),
    db
      .select({ optionId: optionVotes.optionId, userId: optionVotes.userId, kind: optionVotes.kind })
      .from(optionVotes)
      .where(eq(optionVotes.tripId, tripId)),
    db.select({ userId: tripTickets.userId }).from(tripTickets).where(eq(tripTickets.tripId, tripId)),
    db.select().from(expenses).where(eq(expenses.tripId, tripId)).orderBy(desc(expenses.createdAt)),
    db.select().from(settlements).where(eq(settlements.tripId, tripId)),
    db
      .select({ status: agencyRequests.status })
      .from(agencyRequests)
      .where(eq(agencyRequests.tripId, tripId)),
  ]);

  const ids = new Set(people.map((p) => p.id));
  const mine = checks.filter((c) => c.userId === viewerId);
  const ready = people.filter((p) => {
    const own = checks.filter((c) => c.userId === p.id);
    return own.length > 0 && own.every((c) => c.done);
  }).length;

  const optionView = (kind: Kind) =>
    options
      .filter((o) => o.kind === kind)
      .map((o) => ({
        id: o.id,
        title: o.title,
        detail: o.detail,
        price: o.priceMinor,
        nights: o.nights,
        url: o.url,
        bookedBy: o.bookedBy,
        votes: votes.filter((v) => v.optionId === o.id).length,
        canRemove: o.createdBy === viewerId,
      }));

  return {
    members: people,
    plan: plan.map((p) => ({
      id: p.id,
      day: p.day,
      place: p.place,
      note: p.note,
      proposed: p.proposed,
      mine: p.createdBy === viewerId,
    })),
    checklist: mine.map(({ id, label, done }) => ({ id, label, done })),
    ready,
    options: { flight: optionView("flight"), stay: optionView("stay"), offer: optionView("offer") },
    myVotes: Object.fromEntries(votes.filter((v) => v.userId === viewerId).map((v) => [v.kind, v.optionId])),
    tickets: tickets.map((t) => t.userId).filter((u) => ids.has(u)),
    expenses: exps.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: e.amountMinor,
      paidBy: e.paidBy,
      split: e.splitAmong.length,
      canRemove: e.createdBy === viewerId,
    })),
    total: exps.reduce((s, e) => s + e.amountMinor, 0),
    debts: settle(
      exps.map((e) => ({ paidBy: e.paidBy, amount: e.amountMinor, splitAmong: e.splitAmong })),
      pays.map((p) => ({ from: p.fromUser, to: p.toUser, amount: p.amountMinor })),
    ),
    agencyRequested: request.length > 0,
  };
}

export type Board = NonNullable<Awaited<ReturnType<typeof getBoard>>>;

/**
 * Apply one change. Returns false when the viewer may not do it (not found / not theirs).
 * Every change notifies open room pages to refetch.
 */
export async function applyOp(
  ctx: { tripId: string; conversationId: string; userId: string; organizerId: string | null },
  op: BoardOp,
) {
  const { tripId, userId } = ctx;
  const people = await members(userId, tripId);
  if (!people) return false;
  const isOrganizer = ctx.organizerId === userId;
  const everyone = people.map((p) => p.id);

  const ok = await getDb().transaction(async (tx) => {
    // Organizer may remove anything; members only what they created.
    const own = (col: AnyPgColumn) => (isOrganizer ? undefined : eq(col, userId));
    switch (op.op) {
      case "plan.add":
        await tx.insert(planItems).values({
          tripId,
          day: op.day,
          place: op.place,
          note: op.note || null,
          createdBy: userId,
          proposed: !isOrganizer,
        });
        return true;
      case "plan.accept":
        if (!isOrganizer) return false;
        return (
          (
            await tx
              .update(planItems)
              .set({ proposed: false })
              .where(and(eq(planItems.id, op.id), eq(planItems.tripId, tripId)))
              .returning({ id: planItems.id })
          ).length > 0
        );
      case "plan.remove":
        return (
          (
            await tx
              .delete(planItems)
              .where(and(eq(planItems.id, op.id), eq(planItems.tripId, tripId), own(planItems.createdBy)))
              .returning({ id: planItems.id })
          ).length > 0
        );
      case "check.add":
        await tx.insert(checklistItems).values({ tripId, userId, label: op.label }).onConflictDoNothing();
        return true;
      case "check.toggle":
      case "check.remove": {
        const where = and(
          eq(checklistItems.id, op.id),
          eq(checklistItems.tripId, tripId),
          eq(checklistItems.userId, userId),
        );
        const r =
          op.op === "check.toggle"
            ? await tx
                .update(checklistItems)
                .set({ done: op.done })
                .where(where)
                .returning({ id: checklistItems.id })
            : await tx.delete(checklistItems).where(where).returning({ id: checklistItems.id });
        return r.length > 0;
      }
      case "option.add":
        await tx.insert(tripOptions).values({
          tripId,
          kind: op.kind,
          title: op.title,
          detail: op.detail || null,
          priceMinor: op.price === undefined ? null : toMinor(op.price),
          nights: op.kind === "stay" ? (op.nights ?? null) : null,
          url: op.kind === "stay" ? (op.url ?? null) : null,
          createdBy: userId,
        });
        return true;
      case "option.vote": {
        const [o] = await tx
          .select({ kind: tripOptions.kind })
          .from(tripOptions)
          .where(and(eq(tripOptions.id, op.id), eq(tripOptions.tripId, tripId)));
        if (!o) return false;
        await tx
          .insert(optionVotes)
          .values({ tripId, kind: o.kind, optionId: op.id, userId })
          .onConflictDoUpdate({
            target: [optionVotes.tripId, optionVotes.kind, optionVotes.userId],
            set: { optionId: op.id },
          });
        return true;
      }
      case "option.remove":
        return (
          (
            await tx
              .delete(tripOptions)
              .where(
                and(
                  eq(tripOptions.id, op.id),
                  eq(tripOptions.tripId, tripId),
                  inArray(tripOptions.kind, ["flight", "stay"]),
                  sql`${tripOptions.bookedBy} is null`,
                  own(tripOptions.createdBy),
                ),
              )
              .returning({ id: tripOptions.id })
          ).length > 0
        );
      case "ticket.set":
        if (op.bought) await tx.insert(tripTickets).values({ tripId, userId }).onConflictDoNothing();
        else
          await tx
            .delete(tripTickets)
            .where(and(eq(tripTickets.tripId, tripId), eq(tripTickets.userId, userId)));
        return true;
      case "deadline.set":
        if (!isOrganizer) return false;
        await setTicketDeadline(tx, tripId, op.day);
        return true;
      case "stay.book": {
        // One person books the winner; the total goes to costs, split among everyone.
        const [o] = await tx
          .update(tripOptions)
          .set({ bookedBy: userId })
          .where(
            and(
              eq(tripOptions.id, op.id),
              eq(tripOptions.tripId, tripId),
              eq(tripOptions.kind, "stay"),
              sql`${tripOptions.bookedBy} is null`,
            ),
          )
          .returning({ title: tripOptions.title });
        if (!o) return false;
        await tx.insert(expenses).values({
          tripId,
          paidBy: userId,
          createdBy: userId,
          title: o.title,
          category: "stay",
          amountMinor: toMinor(op.amount),
          splitAmong: everyone,
          optionId: op.id,
        });
        return true;
      }
      case "expense.add":
        if (!everyone.includes(op.paidBy)) return false;
        await tx.insert(expenses).values({
          tripId,
          paidBy: op.paidBy,
          createdBy: userId,
          title: op.title,
          category: op.category,
          amountMinor: toMinor(op.amount),
          splitAmong: everyone,
        });
        return true;
      case "expense.remove": {
        const [e] = await tx
          .delete(expenses)
          .where(and(eq(expenses.id, op.id), eq(expenses.tripId, tripId), own(expenses.createdBy)))
          .returning({ optionId: expenses.optionId });
        if (!e) return false;
        // Removing the booking's cost un-books the stay, so someone can book it again.
        if (e.optionId)
          await tx.update(tripOptions).set({ bookedBy: null }).where(eq(tripOptions.id, e.optionId));
        return true;
      }
      case "settle":
        if (op.to === userId || !everyone.includes(op.to)) return false;
        await tx
          .insert(settlements)
          .values({ tripId, fromUser: userId, toUser: op.to, amountMinor: toMinor(op.amount) });
        return true;
      case "agency.request":
        await tx
          .insert(agencyRequests)
          .values({ tripId, requestedBy: userId, people: everyone.length })
          .onConflictDoNothing();
        return true;
    }
  });
  if (ok) await emit(getDb(), { t: "board", c: ctx.conversationId });
  return ok;
}
