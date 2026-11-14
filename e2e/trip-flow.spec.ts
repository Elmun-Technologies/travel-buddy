import { type Browser, expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { onboard, signedLoginUrl } from "./helpers";

// Full UI flow with real signed Telegram logins (server runs with the same test bot token).
const dbUrl = process.env.DATABASE_URL;
const base = Math.floor(Math.random() * 1e9) + 2e9;

async function loginAndOnboard(browser: Browser, id: number, name: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(signedLoginUrl(id, name));
  await onboard(page, name);
  return page;
}

const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

test.describe("trip flow", () => {
  test.skip(!dbUrl, "needs DATABASE_URL");
  test.describe.configure({ mode: "serial" });
  const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null!;

  test.afterAll(async () => {
    const ids = sql`select user_id from auth_accounts where provider='telegram' and provider_user_id in (${String(base + 1)}, ${String(base + 2)})`;
    await sql`delete from trips where owner_user_id in (${ids})`;
    await sql`delete from users where id in (${ids})`;
    await sql.end();
  });

  test("organizer creates a trip, traveler requests, organizer approves", async ({ browser }) => {
    const title = `TEST e2e trip ${base}`;
    const owner = await loginAndOnboard(browser, base + 1, "Malika");

    // Unverified phone → trip form is replaced by the bot CTA.
    await owner.goto("/uz/trips/new");
    await expect(owner.getByText("Botda tasdiqlash")).toBeVisible();
    await sql`update users set phone_verified = true, phone = ${`+99891${String(base).slice(-7)}`}
      where id = (select user_id from auth_accounts where provider='telegram' and provider_user_id=${String(base + 1)})`;

    await owner.reload();
    await owner.fill("#title", title);
    await owner.selectOption("#destinationCountry", "GE");
    await owner.fill("#startDate", plusDays(30));
    await owner.fill("#endDate", plusDays(35));
    await owner.fill("#groupSizeMax", "3");
    await owner.getByText("Tog' va trekking", { exact: true }).click();
    await owner.getByRole("button", { name: "E'lon qilish" }).click();
    await expect(owner.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(owner.getByText("Yangi so'rov yo'q.")).toBeVisible();
    const tripUrl = owner.url();

    const traveler: Page = await loginAndOnboard(browser, base + 2, "Aziz");
    await traveler.goto("/uz/trips?all=1&country=GE");
    await expect(traveler.getByRole("heading", { name: /Gruziya: \d+ ta safar topildi/ })).toBeVisible();
    await traveler.getByText(title).click();
    await traveler.getByRole("button", { name: "Men ham boraman!" }).click();
    await expect(traveler.getByText("So'rovingiz yuborildi", { exact: false })).toBeVisible();

    await owner.goto(tripUrl);
    await expect(owner.getByRole("link", { name: "Aziz" })).toBeVisible();
    await owner.getByRole("button", { name: "Qabul qilish" }).click();
    // Wait for the approval to commit (requests list empties) before checking the traveler side.
    await expect(owner.getByText("Yangi so'rov yo'q.")).toBeVisible();

    await traveler.reload();
    await expect(traveler.getByText("Siz guruhdasiz!")).toBeVisible();
    await expect(traveler.getByText("Ishtirokchilar · 2/3")).toBeVisible();
  });

  test("bad signature does not log in", async ({ page }) => {
    await page.goto(signedLoginUrl(base + 3, "X").replace(/hash=[0-9a-f]+/, "hash=deadbeef"));
    await expect(page).toHaveURL(/\/uz\/login\?error=failed/);
  });
});
