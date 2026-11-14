import { z } from "zod";

const id = z.uuid();
const money = z.number().positive().max(1_000_000); // in major units (dollars); stored as cents
const url = z
  .url({ protocol: /^https$/ })
  .max(500)
  .optional();

/** Every change to the room board goes through one POST with an "op". */
export const boardOp = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("plan.add"),
    day: z.int().min(1).max(60),
    place: z.string().trim().min(1).max(60),
    note: z.string().trim().max(200).optional(),
  }),
  z.object({ op: z.literal("plan.accept"), id }),
  z.object({ op: z.literal("plan.remove"), id }),
  z.object({ op: z.literal("check.add"), label: z.string().trim().min(1).max(60) }),
  z.object({ op: z.literal("check.toggle"), id, done: z.boolean() }),
  z.object({ op: z.literal("check.remove"), id }),
  z.object({
    op: z.literal("option.add"),
    kind: z.enum(["flight", "stay"]),
    title: z.string().trim().min(1).max(80),
    detail: z.string().trim().max(80).optional(),
    price: money.optional(),
    nights: z.int().min(1).max(60).optional(),
    url,
  }),
  z.object({ op: z.literal("option.vote"), id }),
  z.object({ op: z.literal("option.remove"), id }),
  z.object({ op: z.literal("ticket.set"), bought: z.boolean() }),
  z.object({ op: z.literal("deadline.set"), day: z.iso.date().nullable() }),
  z.object({ op: z.literal("stay.book"), id, amount: money }),
  z.object({
    op: z.literal("expense.add"),
    title: z.string().trim().min(1).max(60),
    category: z.enum(["stay", "transport", "food", "other"]),
    amount: money,
    paidBy: id,
  }),
  z.object({ op: z.literal("expense.remove"), id }),
  z.object({ op: z.literal("settle"), to: id, amount: money }),
  z.object({ op: z.literal("agency.request") }),
]);
export type BoardOp = z.infer<typeof boardOp>;

export const toMinor = (major: number) => Math.round(major * 100);
