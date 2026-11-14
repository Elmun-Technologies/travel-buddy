import { sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { getDb } from "@/lib/db";
import { seedSamples } from "./seed";

it("refuses outside staging/development", async () => {
  await expect(seedSamples(null as never, "production")).rejects.toThrow(/refused/);
  await expect(seedSamples(null as never, undefined)).rejects.toThrow(/refused/);
});

it.runIf(!!process.env.DATABASE_URL)("is idempotent and marks everything as test data", async () => {
  await seedSamples(getDb(), "development");
  const n = await seedSamples(getDb(), "development");
  expect(n).toBeGreaterThanOrEqual(10);
  const [r] = await getDb().execute<{ bad: number; women: number }>(sql`
    select
      (select count(*)::int from trips where id::text like '00000000-0000-4000-8000-0000000002%' and not is_test) as bad,
      (select count(*)::int from trip_members m join traveler_profiles p on p.user_id = m.user_id
        join trips t on t.id = m.trip_id where t.women_only and t.is_test and p.gender <> 'female') as women`);
  expect(r).toEqual({ bad: 0, women: 0 });
});
