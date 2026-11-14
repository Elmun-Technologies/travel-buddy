import { eq } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { conversations, tripMembers, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { applyOp, getBoard } from "./service";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];

afterAll(async () => {
  if (!run) return;
  for (const id of made) {
    await getDb().delete(trips).where(eq(trips.ownerUserId, id));
    await getDb().delete(users).where(eq(users.id, id));
  }
});

it.runIf(run)("board: votes, booking goes to costs, debts settle, members only", async () => {
  const db = getDb();
  const [a, b, outsider] = await Promise.all(
    [0, 1, 2].map(
      async () => (await db.insert(users).values({ locale: "uz" }).returning({ id: users.id }))[0].id,
    ),
  );
  made.push(a, b, outsider);
  const [trip] = await db
    .insert(trips)
    .values({
      kind: "independent",
      ownerUserId: a,
      title: "TEST board",
      destinationCountry: "GE",
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      status: "open",
      isTest: true,
    })
    .returning({ id: trips.id });
  await db.insert(tripMembers).values([
    { tripId: trip.id, userId: a, role: "organizer", status: "approved" },
    { tripId: trip.id, userId: b, status: "approved" },
  ]);
  const [c] = await db.insert(conversations).values({ kind: "trip_group", tripId: trip.id }).returning();
  const ctx = (userId: string) => ({ tripId: trip.id, conversationId: c.id, userId, organizerId: a });

  expect(await getBoard(trip.id, outsider)).toBeNull();
  expect(await applyOp(ctx(outsider), { op: "ticket.set", bought: true })).toBe(false);

  // Member's plan item is a proposal; only the organizer accepts it.
  await applyOp(ctx(b), { op: "plan.add", day: 1, place: "Tbilisi" });
  let board = (await getBoard(trip.id, b))!;
  expect(board.plan[0].proposed).toBe(true);
  expect(await applyOp(ctx(b), { op: "plan.accept", id: board.plan[0].id })).toBe(false);
  expect(await applyOp(ctx(a), { op: "plan.accept", id: board.plan[0].id })).toBe(true);
  expect(board.checklist).toHaveLength(5); // defaults on first visit

  // Stay: vote twice = one vote; booking puts the total into costs, split by two.
  await applyOp(ctx(b), { op: "option.add", kind: "stay", title: "Mehmon uyi", price: 25, nights: 3 });
  const stay = (await getBoard(trip.id, a))!.options.stay[0];
  await applyOp(ctx(a), { op: "option.vote", id: stay.id });
  await applyOp(ctx(a), { op: "option.vote", id: stay.id });
  expect(await applyOp(ctx(a), { op: "stay.book", id: stay.id, amount: 75 })).toBe(true);
  expect(await applyOp(ctx(b), { op: "stay.book", id: stay.id, amount: 75 })).toBe(false); // already booked
  board = (await getBoard(trip.id, b))!;
  expect(board.options.stay[0].votes).toBe(1);
  expect(board.total).toBe(7500);
  expect(board.debts).toEqual([{ from: b, to: a, amount: 3750 }]);

  // Paid by someone outside the group is refused; repayment clears the debt.
  expect(
    await applyOp(ctx(b), { op: "expense.add", title: "x", category: "food", amount: 10, paidBy: outsider }),
  ).toBe(false);
  expect(await applyOp(ctx(b), { op: "settle", to: a, amount: 37.5 })).toBe(true);
  expect((await getBoard(trip.id, a))!.debts).toEqual([]);
});
