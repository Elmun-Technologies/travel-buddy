import { z } from "zod";
import { COUNTRIES } from "@/lib/catalog";

const id = z.uuid();
const country = z.enum(COUNTRIES);
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);
const opt = <T extends z.ZodTypeAny>(s: T) => s.optional().nullable();
const money = z.number().min(0).max(100_000); // dollars in the form; stored as cents

/** Every admin change is one "op"; each is written to audit_logs with the admin's id. */
export const adminOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("report.close"), id, resolution: z.enum(["resolved", "dismissed"]) }),
  z.object({ op: z.literal("message.hide"), id, reportId: opt(id) }),
  z.object({ op: z.literal("trip.hide"), id, reportId: opt(id) }),
  z.object({ op: z.literal("trip.restore"), id }),
  z.object({ op: z.literal("user.suspend"), id, reportId: opt(id) }),
  z.object({ op: z.literal("user.restore"), id }),
  z.object({
    op: z.literal("visa.save"),
    destination: country,
    status: z.enum(["visa_free", "evisa", "visa_required"]),
    maxStayDays: opt(z.int().min(1).max(3650)),
    visaName: opt(z.string().trim().max(60)),
    documents: z.array(z.string().trim().min(1).max(120)).max(15),
    notes: opt(z.string().trim().max(160)),
    checkedAt: z.iso.date(),
    sourceUrl: opt(httpsUrl),
    embassyPhone: opt(
      z
        .string()
        .trim()
        .regex(/^\+?[\d\s()-]{5,25}$/),
    ),
    embassyUrl: opt(httpsUrl),
  }),
  z.object({ op: z.literal("visa.delete"), destination: country }),
  z.object({
    op: z.literal("agency.save"),
    id: opt(id),
    name: z.string().trim().min(1).max(80),
    countries: z.array(country).min(1).max(31),
    rating: opt(z.number().min(0).max(5)),
    price: opt(money),
    note: opt(z.string().trim().max(80)),
    contactUrl: opt(httpsUrl),
  }),
  z.object({ op: z.literal("agency.delete"), id }),
  z.object({
    op: z.literal("price.save"),
    destination: country,
    days: z.int().min(1).max(60),
    roomType: z.enum(["quad", "double", "single"]),
    p25: money,
    median: money,
    p75: money,
    sampleSize: z.int().min(0).max(100_000),
    items: z
      .array(
        z.object({ key: z.enum(["flight", "stay", "food", "transport", "tours", "other"]), amount: money }),
      )
      .max(6),
  }),
  z.object({ op: z.literal("price.delete"), id }),
  z.object({ op: z.literal("request.status"), id, status: z.enum(["new", "sent", "answered", "closed"]) }),
  z.object({
    op: z.literal("offer.add"),
    tripId: id,
    title: z.string().trim().min(1).max(80), // agency name
    detail: opt(z.string().trim().max(80)), // "4 kishilik xona · hammasi kirgan · ★ 4.8"
    price: money, // per person
  }),
  z.object({ op: z.literal("offer.remove"), id }),
  z.object({
    op: z.literal("creator.set"),
    id,
    status: z.enum(["joined", "tracking", "approved", "rejected", "paid"]),
    views: opt(z.int().min(0).max(2_000_000_000)), // Instagram "views" (organic), read by hand for now
    note: opt(z.string().trim().max(200)),
  }),
]);
export type AdminOp = z.infer<typeof adminOp>;
