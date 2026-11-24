import { z } from "zod";
import { ACCOMMODATION, COUNTRIES, CURRENCIES, todayISO, TRAVEL_STYLES } from "@/lib/catalog";

const MAX_TRIP_DAYS = 90;
const DAY = 86_400_000;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
// Budget is entered in major units (e.g. 500 USD), stored in minor units.
const money = z.coerce
  .number()
  .int()
  .min(0)
  .max(10_000_000) // x100 must stay inside a 32-bit column
  .transform((v) => v * 100)
  .nullable()
  .catch(null);

const place = {
  destinationCountry: z.enum(COUNTRIES),
  destinationCity: optionalText(60),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  dateFlexDays: z.coerce.number().int().min(0).max(14).default(0),
  budgetMin: money,
  budgetMax: money,
  currency: z.enum(CURRENCIES).default("USD"),
  travelStyles: z.array(z.enum(TRAVEL_STYLES)).max(6).default([]),
};

type Dated = { startDate: string; endDate: string; budgetMin: number | null; budgetMax: number | null };

function checkDatesAndBudget(v: Dated, ctx: z.RefinementCtx) {
  if (v.startDate < todayISO()) ctx.addIssue({ code: "custom", path: ["startDate"], message: "past" });
  if (v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "before_start" });
  else if ((Date.parse(v.endDate) - Date.parse(v.startDate)) / DAY > MAX_TRIP_DAYS)
    ctx.addIssue({ code: "custom", path: ["endDate"], message: "too_long" });
  if (v.budgetMin != null && v.budgetMax != null && v.budgetMin > v.budgetMax)
    ctx.addIssue({ code: "custom", path: ["budgetMax"], message: "min_gt_max" });
}

export const tripSchema = z
  .object({
    ...place,
    title: z.string().trim().min(5).max(80),
    groupSizeMax: z.coerce.number().int().min(2).max(30),
    ageMin: z.coerce.number().int().min(18).max(99).nullable().catch(null),
    ageMax: z.coerce.number().int().min(18).max(99).nullable().catch(null),
    womenOnly: z.boolean().default(false),
    accommodationPref: z.enum(ACCOMMODATION).default("any"),
    description: optionalText(2000),
    datePrecision: z.enum(["exact", "month"]).default("exact"),
  })
  .superRefine((v, ctx) => {
    checkDatesAndBudget(v, ctx);
    if (v.ageMin != null && v.ageMax != null && v.ageMin > v.ageMax)
      ctx.addIssue({ code: "custom", path: ["ageMax"], message: "min_gt_max" });
  });

export const intentSchema = z.object({ ...place, note: optionalText(500) }).superRefine(checkDatesAndBudget);

export type TripInput = z.output<typeof tripSchema>;
export type IntentInput = z.output<typeof intentSchema>;

function placeFromForm(f: FormData) {
  return {
    destinationCountry: f.get("destinationCountry"),
    destinationCity: f.get("destinationCity") ?? "",
    startDate: f.get("startDate"),
    endDate: f.get("endDate"),
    dateFlexDays: f.get("dateFlexDays") || 0,
    budgetMin: f.get("budgetMin") || null,
    budgetMax: f.get("budgetMax") || null,
    currency: f.get("currency") || "USD",
    travelStyles: f.getAll("travelStyles"),
  };
}

export function intentFromForm(f: FormData) {
  return { ...placeFromForm(f), note: f.get("note") ?? "" };
}

/** "GE,TR" → ["GE","TR"]; unknown values dropped. */
const csvOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .max(200)
    .transform((v) => v.split(",").filter((x): x is T[number] => (values as readonly string[]).includes(x)))
    .optional()
    .catch(undefined);

export const feedFilterSchema = z.object({
  country: csvOf(COUNTRIES),
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional()
    .catch(undefined),
  date: z.iso.date().optional().catch(undefined), // "Aniq sana": trips running on that day (± flex)
  budget: z.coerce.number().int().min(1).optional().catch(undefined),
  style: csvOf(TRAVEL_STYLES),
  visa: z.literal("free").optional().catch(undefined), // "Vizasiz": no visa for the traveler's passport
  all: z.literal("1").optional().catch(undefined), // explicit "Hammasi": don't prefill from the profile
  page: z.coerce.number().int().min(1).max(100).default(1).catch(1),
});
export type FeedFilter = z.output<typeof feedFilterSchema>;

/** Trip creation in 3 steps (App-CreateTrip): the client sends choices, the server derives the rest. */
export const createTripBody = z.object({
  country: z.enum(COUNTRIES),
  city: z.string().trim().max(60).optional(),
  when: z.enum(["this_month", "next_month", "exact"]),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  flex: z.boolean().default(false), // "±2 kun bo'lsa ham mayli"
  size: z.number().int().min(3).max(20), // open trips start at 3 people (product-decisions §5)
  band: z.enum(["lt300", "300_600", "600_1000", "any"]),
  styles: z.array(z.enum(TRAVEL_STYLES)).max(6).default([]),
  womenOnly: z.boolean().default(false),
  note: z.string().trim().max(280).optional(),
});
export type CreateTripBody = z.output<typeof createTripBody>;

const BAND: Record<CreateTripBody["band"], [number | null, number | null]> = {
  lt300: [null, 300],
  "300_600": [300, 600],
  "600_1000": [600, 1000],
  any: [null, null],
};

/** Month choice → first..last day (this month starts today); exact → as given. */
export function datesFor(b: CreateTripBody, today = todayISO()) {
  if (b.when === "exact")
    return { startDate: b.startDate ?? "", endDate: b.endDate ?? "", datePrecision: "exact" as const };
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + (b.when === "next_month" ? 1 : 0), 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    startDate: b.when === "this_month" ? today : iso(first),
    endDate: iso(last),
    datePrecision: "month" as const,
  };
}

export const bandToBudget = (band: CreateTripBody["band"]) => BAND[band];
