import { createHmac } from "node:crypto";
import { type Browser, expect, test } from "@playwright/test";
import postgres from "postgres";

// Onboarding inside the Telegram Mini App: signed initData, Telegram WebView UA, interrupted session,
// failed submit, and a page that outlived a deploy. Phase 3 bug: submit silently lost everything.
const TOKEN = process.env.E2E_BOT_TOKEN ?? "1:e2e-test-token";
const dbUrl = process.env.DATABASE_URL;
const tgId = Math.floor(Math.random() * 1e9) + 4e9;
const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36 Telegram-Android/11.4.2";

function initData(id: number, name: string) {
  const p = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAE2e",
    user: JSON.stringify({ id, first_name: name, language_code: "uz" }),
  });
  const check = [...p.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(TOKEN).digest();
  p.set("hash", createHmac("sha256", secret).update(check).digest("hex"));
  return p.toString();
}

/** A fresh "Mini App launch": new WebView (empty storage), Telegram's script stubbed with signed initData. */
async function openMiniApp(browser: Browser) {
  const ctx = await browser.newContext({ userAgent: UA });
  const data = initData(tgId, "Nodira");
  await ctx.route("https://telegram.org/js/telegram-web-app.js*", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: `window.Telegram={WebApp:{initData:${JSON.stringify(data)},ready(){},expand(){}}};`,
    }),
  );
  const page = await ctx.newPage();
  await page.goto("/uz/tg");
  await expect(page).toHaveURL(/\/uz\/onboarding/);
  return page;
}

test.describe("Mini App onboarding", () => {
  test.skip(!dbUrl, "needs DATABASE_URL");
  const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null!;
  const userId = () =>
    sql`select user_id from auth_accounts where provider='telegram' and provider_user_id=${String(tgId)}`;

  test.afterAll(async () => {
    await sql`delete from users where id in (${userId()})`;
    await sql.end();
  });

  test("survives a closed app, a failed submit and a new deploy", async ({ browser }) => {
    // 1. Start filling, then the user closes Telegram.
    const first = await openMiniApp(browser);
    await expect(first.locator("#displayName")).toHaveValue("Nodira");
    await first.fill("#birthDate", "1998-03-21");
    await first.getByText("Trekking", { exact: true }).click();
    await expect(first.getByText("Saqlandi ✓")).toBeVisible();
    await first.context().close();

    // 2. Reopen on a clean WebView: answers come back from the server draft.
    const page = await openMiniApp(browser);
    await expect(page.locator("#birthDate")).toHaveValue("1998-03-21");
    await expect(page.locator('input[name="travelStyles"][value="trekking"]')).toBeChecked();

    // 3. A deploy happens while the page is open → the user is offered a refresh.
    await page.route("**/api/version", (r) => r.fulfill({ json: { id: "newer-build" } }));
    // Re-dispatch until the banner's listener is attached (hydration timing).
    await expect(async () => {
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await expect(page.getByText("Ilovaning yangi versiyasi chiqdi.")).toBeVisible({ timeout: 500 });
    }).toPass();

    // 4. Submit fails (connection drops): friendly message, nothing lost, retry works.
    await page.route("**/api/profile", (r) => r.abort(), { times: 1 });
    await page.getByRole("button", { name: "Saqlash" }).click();
    await expect(page.getByText("Hammasi saqlangan", { exact: false })).toBeVisible();
    await expect(page.locator("#birthDate")).toHaveValue("1998-03-21");
    await page.getByRole("button", { name: "Qayta urinish" }).click();
    await expect(page).toHaveURL(/\/uz\/trips$/);

    const [{ n }] =
      await sql`select count(*)::int as n from onboarding_drafts where user_id in (${userId()})`;
    expect(n).toBe(0);
    const [p] =
      await sql`select birth_date::text as b, travel_styles as s from traveler_profiles where user_id in (${userId()})`;
    expect(p).toMatchObject({ b: "1998-03-21", s: ["trekking"] });
  });

  test("profile API rejects cross-site posts", async ({ request }) => {
    const res = await request.post("/api/profile", {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      data: {},
    });
    expect(res.status()).toBe(403);
  });
});
