import { type Browser, expect, test } from "@playwright/test";
import postgres from "postgres";
import { onboard, signedLoginUrl } from "./helpers";

// Organizer edits a published trip; a traveler blocks the organizer from their profile page.
const dbUrl = process.env.DATABASE_URL;
const base = Math.floor(Math.random() * 1e9) + 4e9;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function loginAndOnboard(browser: Browser, id: number, name: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(signedLoginUrl(id, name));
  await onboard(page, name);
  return page;
}

test.describe("edit trip and block from profile", () => {
  test.skip(!dbUrl, "needs DATABASE_URL");
  const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null!;

  test.afterAll(async () => {
    const ids = sql`select user_id from auth_accounts where provider='telegram' and provider_user_id in (${String(base + 1)}, ${String(base + 2)})`;
    await sql`delete from reports where reporter_id in (${ids})`;
    await sql`delete from trips where owner_user_id in (${ids})`;
    await sql`delete from users where id in (${ids})`;
    await sql.end();
  });

  test("organizer changes the size and note; traveler blocks the organizer", async ({ browser }) => {
    test.setTimeout(90_000);
    const owner = await loginAndOnboard(browser, base + 1, "Dilnoza");
    await sql`update users set phone_verified = true, phone = ${`+99892${String(base).slice(-7)}`}
      where id = (select user_id from auth_accounts where provider='telegram' and provider_user_id=${String(base + 1)})`;

    const origin = new URL(owner.url()).origin;
    const created = await owner.request.post("/api/trips", {
      headers: { origin, "content-type": "application/json" },
      data: {
        locale: "uz",
        country: "GE",
        when: "exact",
        startDate: plusDays(30),
        endDate: plusDays(34),
        flex: false,
        size: 5,
        band: "any",
        styles: [],
        womenOnly: false,
      },
    });
    expect(created.status()).toBe(200);
    const { id } = (await created.json()) as { id: string };

    // Organizer sees the edit link and saves a change (size 5 → 6, a note).
    await owner.goto(`/uz/trips/${id}`);
    await owner.getByRole("link", { name: "Safarni tahrirlash" }).click();
    await expect(owner).toHaveURL(new RegExp(`/uz/trips/${id}/edit$`));
    await owner.waitForLoadState("networkidle");
    await owner.getByRole("button", { name: "+" }).click();
    await owner.getByLabel(/^Bir-ikki so'z/).fill("Kazbegida 2 kun");
    await owner.getByRole("button", { name: "Saqlaymiz" }).click();
    await expect(owner).toHaveURL(new RegExp(`/uz/trips/${id}$`));
    const [row] = await sql`select group_size_max as size, description from trips where id = ${id}`;
    expect(row).toEqual({ size: 6, description: "Kazbegida 2 kun" });

    // Someone else cannot open the edit page.
    const traveler = await loginAndOnboard(browser, base + 2, "Rustam");
    await traveler.goto(`/uz/trips/${id}/edit`);
    await expect(traveler.getByText("Sahifa topilmadi")).toBeVisible();
    await expect(traveler.getByRole("button", { name: "Saqlaymiz" })).toHaveCount(0);

    // Traveler blocks the organizer from the profile page; they no longer see each other.
    const [{ ownerId }] = await sql`select owner_user_id as "ownerId" from trips where id = ${id}`;
    await traveler.goto(`/uz/u/${ownerId}`);
    await expect(traveler.getByRole("button", { name: "Shikoyat qilish" })).toBeVisible();
    await traveler.getByRole("button", { name: "Bloklash" }).click();
    await traveler.getByRole("button", { name: "Ha, bloklayman" }).click();
    await expect(traveler).toHaveURL(/\/uz\/trips$/);
    await traveler.goto(`/uz/u/${ownerId}`);
    await expect(traveler.getByText("topilmadi", { exact: false })).toBeVisible();
    await traveler.goto(`/uz/trips/${id}`);
    await expect(traveler.getByText("topilmadi", { exact: false })).toBeVisible();
  });
});
