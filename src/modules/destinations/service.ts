import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { priceStats, visaAgencies, visaRules } from "@/db/schema";
import { getDb } from "@/lib/db";

const PASSPORT = "UZ"; // ponytail: first market; take it from the profile when other passports come

export type VisaRule = typeof visaRules.$inferSelect;

export async function listVisaRules() {
  return getDb()
    .select()
    .from(visaRules)
    .where(eq(visaRules.passportCountry, PASSPORT))
    .orderBy(asc(visaRules.status), asc(visaRules.destination));
}

export async function getVisaRule(country: string) {
  const [r] = await getDb()
    .select()
    .from(visaRules)
    .where(and(eq(visaRules.passportCountry, PASSPORT), eq(visaRules.destination, country)));
  return r ?? null;
}

/** Destinations where this passport needs no visa (feed filter "Vizasiz"). */
export async function visaFreeCountries() {
  const rows = await getDb()
    .select({ c: visaRules.destination })
    .from(visaRules)
    .where(and(eq(visaRules.passportCountry, PASSPORT), eq(visaRules.status, "visa_free")));
  return rows.map((r) => r.c);
}

/** Partner agencies for a country, best rated first. */
export async function listVisaAgencies(country: string) {
  return getDb()
    .select()
    .from(visaAgencies)
    .where(sql`${country} = any(${visaAgencies.countries})`)
    .orderBy(desc(sql`coalesce(${visaAgencies.rating}, 0)`));
}

export type PriceItem = { key: string; amount: number };
export type PriceStat = Omit<typeof priceStats.$inferSelect, "items"> & { items: PriceItem[] };

/** All room types for the destination, using the row whose length is closest to `days`. */
export async function getPrices(country: string, days?: number) {
  const rows = (await getDb()
    .select()
    .from(priceStats)
    .where(eq(priceStats.destination, country))) as PriceStat[];
  const target = days ?? rows[0]?.days;
  const best = new Map<string, PriceStat>();
  for (const r of rows) {
    const cur = best.get(r.roomType);
    if (!cur || Math.abs(r.days - target!) < Math.abs(cur.days - target!)) best.set(r.roomType, r);
  }
  return (["quad", "double", "single"] as const).flatMap((k) => (best.has(k) ? [best.get(k)!] : []));
}
