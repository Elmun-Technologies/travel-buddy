import { createHmac } from "node:crypto";
import { type Browser, expect, test } from "@playwright/test";
import postgres from "postgres";
import { pickBirthDate, TOKEN } from "./helpers";

// Onboarding inside the Telegram Mini App: signed initData, Telegram WebView UA, interrupted session,
// failed submit, and a page that outlived a deploy. Phase 3 bug: submit silently lost everything.
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
async function openMiniApp(browser: Browser, id = tgId) {
  const ctx = await browser.newContext({ userAgent: UA });
  const data = initData(id, "Nodira");
  await ctx.route("https://telegram.org/js/telegram-web-app.js*", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: `window.Telegram={WebApp:{initData:${JSON.stringify(data)},ready(){},expand(){}}};`,
    }),
  );
  const page = await ctx.newPage();
  await page.goto("/uz/tg");
  await expect(page).toHaveURL(/\/uz\/welcome/);
  await page.getByRole("link", { name: "Boshladik!" }).click();
  await expect(page).toHaveURL(/\/uz\/onboarding/);
  await page.waitForLoadState("networkidle"); // hydrated
  return page;
}

test.describe("Mini App onboarding", () => {
  test.skip(!dbUrl, "needs DATABASE_URL");
  const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null!;
  const userId = () =>
    sql`select user_id from auth_accounts where provider='telegram'
      and provider_user_id in (${String(tgId)}, ${String(tgId + 1)})`;

  test.afterAll(async () => {
    await sql`delete from users where id in (${userId()})`;
    await sql.end();
  });

  test("survives a closed app, a failed submit and a new deploy", async ({ browser }) => {
    // 1. Step 1 → step 2, pick a style, then the user closes Telegram.
    const first = await openMiniApp(browser);
    await expect(first.locator("#displayName")).toHaveValue("Nodira");
    await pickBirthDate(first, 21, 3, 1998);
    await expect(first.getByText("21-mart, 1998")).toBeVisible();
    await first.getByRole("radio", { name: "Ayol" }).click();
    await first.getByRole("button", { name: "Davom etamiz", exact: true }).click();
    await first.getByRole("button", { name: "Tog' va trekking" }).click();
    await first.getByRole("radio", { name: "Faqat ayollar" }).click();
    await expect(first.getByText("Saqlandi ✓")).toBeVisible();
    await first.context().close();

    // 2. Reopen on a clean WebView: back on step 2 with the answers from the server draft.
    const page = await openMiniApp(browser);
    await expect(page.getByText("02 / 04")).toBeVisible();
    await expect(page.getByRole("button", { name: "Tog' va trekking" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("radio", { name: "Faqat ayollar" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Orqaga" }).click();
    await expect(page.getByText("21-mart, 1998")).toBeVisible();
    await page.getByRole("button", { name: "Davom etamiz", exact: true }).click();
    await page.getByRole("button", { name: "Davom etamiz · 1 ta tanlandi" }).click();

    // 3. A deploy happens while the page is open → the user is offered a refresh.
    await page.route("**/api/version", (r) => r.fulfill({ json: { id: "newer-build" } }));
    // Re-dispatch until the banner's listener is attached (hydration timing).
    await expect(async () => {
      await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
      await expect(page.getByText("Ilovaning yangi versiyasi chiqdi.")).toBeVisible({ timeout: 500 });
    }).toPass();

    // 4. Submit fails (connection drops): friendly message, nothing lost, retry works.
    await page.getByRole("button", { name: "Gruziya" }).click();
    await page.route("**/api/profile", (r) => r.abort(), { times: 1 });
    await page.getByRole("button", { name: "Profilni saqlaymiz" }).click();
    await expect(page.getByText("Hammasi saqlangan", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Qayta urinish" }).click();

    // 5. Phone step (no Telegram contact API in this stub → bot link), then "Later".
    await expect(page.getByText("04 / 04")).toBeVisible();
    await expect(page.getByRole("button", { name: "Botda tasdiqlayman" })).toBeVisible();
    await page.getByRole("link", { name: "Keyinroq" }).click();
    await expect(page).toHaveURL(/\/uz\/trips$/);

    const [{ n }] =
      await sql`select count(*)::int as n from onboarding_drafts where user_id in (${userId()})`;
    expect(n).toBe(0);
    const [p] =
      await sql`select birth_date::text as b, travel_styles as s, group_pref as g, dream_destinations as d
      from traveler_profiles where user_id in (${userId()})`;
    expect(p).toMatchObject({ b: "1998-03-21", s: ["mountains"], g: "women_only", d: ["GE"] });
  });

  test("language can be switched on step 1 without losing answers", async ({ browser }) => {
    const page = await openMiniApp(browser, tgId + 1);
    await pickBirthDate(page, 22, 2, 1995);
    await page.getByRole("button", { name: "ru", exact: true }).click();
    await expect(page).toHaveURL(/\/ru\/onboarding/);
    await expect(page.getByText("22 февраля 1995").locator("visible=true")).toBeVisible();
    // The previous locale stays mounted but hidden for a moment: assert the visible heading only.
    await expect(page.getByRole("heading", { name: "Давайте знакомиться" })).toBeVisible();
    await page.context().close();
  });

  test("profile API rejects cross-site posts", async ({ request }) => {
    const res = await request.post("/api/profile", {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      data: {},
    });
    expect(res.status()).toBe(403);
  });
});
