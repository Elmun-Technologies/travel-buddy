import { inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { priceStats, visaRules } from "@/db/schema";
import { getDb } from "@/lib/db";
import { getPrices, getVisaRule, visaFreeCountries } from "./service";

const run = !!process.env.DATABASE_URL;
const C = ["QA", "SA"]; // countries the seed never touches

afterAll(async () => {
  if (!run) return;
  await getDb().delete(visaRules).where(inArray(visaRules.destination, C));
  await getDb().delete(priceStats).where(inArray(priceStats.destination, C));
});

it.runIf(run)("visa rules and closest-length prices per room type", async () => {
  const db = getDb();
  await db.delete(visaRules).where(inArray(visaRules.destination, C));
  await db.delete(priceStats).where(inArray(priceStats.destination, C));
  await db.insert(visaRules).values([
    { destination: "QA", status: "visa_free", maxStayDays: 30, checkedAt: "2026-11-14" },
    { destination: "SA", status: "evisa", checkedAt: "2026-11-14" },
  ]);
  expect(await visaFreeCountries()).toContain("QA");
  expect(await visaFreeCountries()).not.toContain("SA");
  expect((await getVisaRule("SA"))?.status).toBe("evisa");

  const row = (days: number, roomType: string, median: number) => ({
    destination: "QA",
    days,
    roomType,
    p25: median - 50,
    median,
    p75: median + 50,
  });
  await db.insert(priceStats).values([row(5, "quad", 500), row(10, "quad", 900), row(7, "single", 800)]);
  const p = await getPrices("QA", 9);
  expect(p.map((x) => [x.roomType, x.median])).toEqual([
    ["quad", 900], // 10 days is closer to 9 than 5
    ["single", 800],
  ]);
  expect(await getPrices("SA")).toEqual([]);
});
