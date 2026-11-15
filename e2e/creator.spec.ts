import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { onboard, signedLoginUrl } from "./helpers";

// 1M Safar (hidden, CREATOR_ENABLED): a member of a running trip joins, posts the Reel link,
// the admin enters views, the traveler sees the progress. Terms and concept pages are noindex.
const ADMIN_TG = 7000000001;
const dbUrl = process.env.DATABASE_URL;

test("1M Safar: join, Reel link, admin views, progress", async ({ browser }) => {
  test.skip(!dbUrl, "needs DATABASE_URL to set up a running trip");
  test.setTimeout(150_000); // two people onboard; the machine is often loaded
  const sql = postgres(dbUrl!, { max: 1 });
  const tg = 7100000000 + Math.floor(Math.random() * 1e6);
  const me = await (await browser.newContext()).newPage();
  await me.goto(signedLoginUrl(tg, "Reelchi"));
  await onboard(me, "Reelchi");

  // A trip that started yesterday, set up in the app weeks ago, with "Reelchi" as its organizer.
  const [{ user_id }] =
    await sql`select user_id from auth_accounts where provider = 'telegram' and provider_user_id = ${String(tg)}`;
  const [{ id: tripId }] = await sql`
    insert into trips (kind, owner_user_id, title, destination_country, start_date, end_date, status, group_size_max, is_test, created_at)
    values ('independent', ${user_id}, 'TEST Kazbegi', 'GE', current_date - 1, current_date + 4, 'open', 4, true, now() - interval '20 days')
    returning id`;
  await sql`insert into trip_members (trip_id, user_id, role, status) values (${tripId}, ${user_id}, 'organizer', 'approved')`;

  try {
    await me.goto(`/uz/trips/${tripId}/creator`);
    await expect(me.getByText("Shaxsiy taklif · Gruziya safaringiz uchun")).toBeVisible();
    await me.waitForLoadState("networkidle");
    await me.getByRole("button", { name: "Qatnashaman" }).click();
    await expect(me).toHaveURL(/\/uz\/creator$/);
    await expect(me.getByText("Reels'ni joyladingizmi?")).toBeVisible();
    await me.waitForLoadState("networkidle");
    await me.getByLabel("Instagram akkaunt").fill("reelchi.travels");
    await me.getByLabel("Reels havolasi").fill("https://example.com/not-a-reel");
    await me.getByRole("button", { name: "Yuboraman" }).click();
    await expect(me.getByText("Havola yoki akkaunt noto'g'ri")).toBeVisible();
    await me.getByLabel("Reels havolasi").fill("https://www.instagram.com/reel/TEST123/");
    await me.getByRole("button", { name: "Yuboraman" }).click();
    await expect(me.getByText("Kuzatilmoqda")).toBeVisible();
    await expect(me.getByText("@reelchi.travels · ✓")).toBeVisible();

    const admin = await (await browser.newContext()).newPage();
    await admin.goto(signedLoginUrl(ADMIN_TG, "Admin"));
    if (/welcome/.test(admin.url())) await onboard(admin, "Admin");
    await admin.goto("/uz/admin/creator");
    await admin.waitForLoadState("networkidle");
    const row = admin.locator("section", { hasText: "@reelchi.travels" });
    await row.getByLabel("Ko'rishlar").fill("640312");
    const saved = admin.waitForResponse((r) => r.url().endsWith("/api/admin"));
    await row.getByRole("button", { name: "Saqlash" }).click();
    const res = await saved;
    expect(res.status()).toBe(200);

    await me.reload();
    await expect(me.getByText(/359\s688/)).toBeVisible(); // views left to 1 000 000

    await me.goto("/uz/1m");
    await expect(me.getByText("Adolatli qoidalar")).toBeVisible();
    expect(await me.locator('meta[name="robots"]').getAttribute("content")).toContain("noindex");
    await me.goto("/en/inbound");
    await expect(me.getByText("Pay for views, not for promises.")).toBeVisible();
  } finally {
    await sql`delete from audit_logs where action = 'creator.set' and target_id in (select id from creator_entries where trip_id = ${tripId})`;
    await sql`delete from trips where id = ${tripId}`;
    await sql.end();
  }
});
