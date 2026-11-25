import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { onboard, signedLoginUrl } from "./helpers";

// The public story page exists only while EVERY member of a finished trip agrees.
const dbUrl = process.env.DATABASE_URL;
const base = Math.floor(Math.random() * 1e9) + 7e9;
const city = `Cityx${base}`; // unique, so the check cannot match translation text

test.describe("public story", () => {
  test.skip(!dbUrl, "needs DATABASE_URL");
  const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null!;
  test.afterAll(async () => {
    await sql`delete from trips where title = ${`TEST story ${base}`}`;
    const ids = sql`select user_id from auth_accounts where provider='telegram' and provider_user_id in (${String(base + 1)}, ${String(base + 2)})`;
    await sql`delete from users where id in (${ids})`;
    await sql.end();
  });

  test("link appears after both agree and disappears when one withdraws", async ({ browser, playwright }) => {
    await sql`delete from rate_limits`;
    const pages = [];
    for (const [n, name] of [
      [1, "Aziza"],
      [2, "Bobur"],
    ] as const) {
      const page = await (await browser.newContext()).newPage();
      await page.goto(signedLoginUrl(base + n, name));
      await onboard(page, name);
      pages.push(page);
    }
    const ids =
      await sql`select user_id as id from auth_accounts where provider='telegram' and provider_user_id in (${String(base + 1)}, ${String(base + 2)}) order by provider_user_id`;
    const code = `S${String(base).slice(-6)}`.replace(/[01OIL]/g, "7");
    const [t] = await sql`
      insert into trips (kind, owner_user_id, title, destination_country, destination_city, start_date, end_date, status, public_code, is_test)
      values ('independent', ${ids[0].id}, ${`TEST story ${base}`}, 'GE', ${city}, '2026-01-01', '2026-01-05', 'completed', ${code}, true)
      returning id`;
    for (const [i, u] of ids.entries())
      await sql`insert into trip_members (trip_id, user_id, role, status) values (${t.id}, ${u.id}, ${i === 0 ? "organizer" : "member"}, 'approved')`;

    // A streamed page cannot change its status code, so "closed" means: no content at all.
    const closed = async () => {
      const html = await (await anon.get(`/uz/s/${code}`)).text();
      expect(html).not.toContain(city);
    };
    const anon = await playwright.request.newContext({ baseURL: new URL(pages[0].url()).origin });
    await closed(); // nobody agreed yet

    await pages[0].goto(`/uz/trips/${t.id}/album`);
    await pages[0].getByLabel(/Men roziman/).check();
    await expect(pages[0].getByText("Rozi: 1 / 2")).toBeVisible();
    await closed(); // one of two

    await pages[1].goto(`/uz/trips/${t.id}/album`);
    await pages[1].getByLabel(/Men roziman/).check();
    await expect(pages[1].getByText("Rozi: 2 / 2")).toBeVisible();

    const html = await (await anon.get(`/uz/s/${code}`)).text();
    expect(html).toContain(city);
    expect(html).toContain("Aziza");
    expect(html).not.toContain("+998"); // no contact data on a public page

    await pages[1].getByLabel(/Men roziman/).uncheck();
    await expect(pages[1].getByText("Rozi: 1 / 2")).toBeVisible();
    await closed();
  });
});
