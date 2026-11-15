import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { onboard, signedLoginUrl } from "./helpers";

// Admin panel: only ADMIN_TELEGRAM_IDS get in (others see a 404); a visa rule entered here shows
// on the public visa page with its "checked on" date.
const ADMIN_TG = 7000000001;
const dbUrl = process.env.DATABASE_URL;

test.afterAll(async () => {
  if (!dbUrl) return;
  const sql = postgres(dbUrl, { max: 1 });
  await sql`delete from visa_rules where destination = 'LK'`;
  await sql`delete from audit_logs where action = 'visa.save' and meta->>'destination' = 'LK'`;
  await sql.end();
});

test("only admins open the panel; a saved visa rule is public at once", async ({ browser }) => {
  test.setTimeout(90_000); // two people go through onboarding
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto(signedLoginUrl(7000000002 + Math.floor(Math.random() * 1e6), "Oddiy"));
  await onboard(stranger, "Oddiy");
  await stranger.goto("/uz/admin");
  await expect(stranger.getByText("Sahifa topilmadi")).toBeVisible();
  expect(
    (await stranger.request.post("/api/admin", { data: { op: "visa.delete", destination: "LK" } })).status(),
  ).not.toBe(200);

  const admin = await (await browser.newContext()).newPage();
  await admin.goto(signedLoginUrl(ADMIN_TG, "Admin"));
  if (/welcome/.test(admin.url())) await onboard(admin, "Admin");
  await admin.goto("/uz/admin/visa");
  await admin.waitForLoadState("networkidle");
  await admin.getByText("+ Davlat qo'shish").click();
  const form = admin.locator("details[open] form");
  await form.locator("select").first().selectOption("LK");
  await form.locator("select").nth(1).selectOption("evisa");
  await form.getByLabel("Necha kungacha").fill("30");
  await form.getByLabel("Manba (rasmiy sayt)").fill("https://eta.gov.lk");
  await form.getByRole("button", { name: "Saqlash" }).click();
  await expect(admin.locator("summary", { hasText: "Shri-Lanka" })).toBeVisible(); // the list row, not the <option>

  await stranger.goto("/uz/visa?c=LK");
  await expect(stranger.getByText("Elektron viza").first()).toBeVisible();
  await admin.goto("/uz/admin/audit");
  await expect(admin.getByText("visa.save").first()).toBeVisible();
});
