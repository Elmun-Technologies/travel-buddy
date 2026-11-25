import { z } from "zod";
import { COUNTRIES, CURRENCIES, TRAVEL_STYLES, todayISO } from "@/lib/catalog";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || /^https:\/\/[^\s]+$/.test(v), "invalid");
const list = (n: number, max: number) => z.array(z.string().trim().min(1).max(max)).max(n).default([]);

export const agencySchema = z.object({
  name: z.string().trim().min(3).max(80),
  legalName: text(120),
  taxId: text(30),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[\d\s()-]{7,20}$/),
  website: httpsUrl,
  description: text(800),
  country: z
    .enum(COUNTRIES)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  city: text(60),
});

export const offerSchema = z
  .object({
    title: z.string().trim().min(5).max(80),
    destinationCountry: z.enum(COUNTRIES),
    destinationCity: text(60),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    price: z.coerce.number().int().min(1).max(100_000),
    currency: z.enum(CURRENCIES).default("USD"),
    seats: z.coerce.number().int().min(1).max(200),
    includes: list(15, 80),
    excludes: list(15, 80),
    itinerary: z
      .array(
        z.object({ title: z.string().trim().min(1).max(80), text: z.string().trim().max(400).default("") }),
      )
      .max(30)
      .default([]),
    refundPolicy: text(500),
    description: text(1500),
    travelStyles: z.array(z.enum(TRAVEL_STYLES)).max(6).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.startDate < todayISO()) ctx.addIssue({ code: "custom", path: ["startDate"], message: "past" });
    if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "before_start" });
  });

export const agencyOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("register"), agency: agencySchema }),
  z.object({ op: z.literal("offer.create"), offer: offerSchema }),
  z.object({ op: z.literal("offer.update"), tripId: z.uuid(), offer: offerSchema }),
  z.object({ op: z.enum(["offer.close", "offer.open"]), tripId: z.uuid() }),
  z.object({
    op: z.literal("lead"),
    leadId: z.uuid(),
    action: z.discriminatedUnion("op", [
      z.object({ op: z.literal("accept") }),
      z.object({ op: z.literal("reject") }),
      z.object({ op: z.literal("cancel") }),
      z.object({ op: z.literal("book"), amount: z.coerce.number().min(0).max(1_000_000) }),
    ]),
  }),
]);
