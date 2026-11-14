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

function initData(id: number, name: string, startParam?: string) {
  const p = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: "AAE2e",
    user: JSON.stringify({ id, first_name: name, language_code: "uz" }),
    ...(startParam ? { start_param: startParam } : {}),
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
      and provider_user_id in (${String(tgId)}, ${String(tgId + 1)}, ${String(tgId + 2)}, ${String(tgId + 3)})`;

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

    // 3. A deploy happens while the Mini App is open → it reloads itself once onto the new build
    //    (answers come back from the server draft); a repeated mismatch only shows the banner.
    await page.route("**/api/version", (r) => r.fulfill({ json: { id: "newer-build" } }));
    await Promise.all([
      page.waitForEvent("load"),
      page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))),
    ]);
    await expect(page.getByText("03 / 04")).toBeVisible();
    await expect(page.getByText("Ilovaning yangi versiyasi chiqdi.")).toBeVisible();

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
    await expect(page).toHaveURL(/\/uz\/home$/);

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

  // Owner bug: a button "did nothing" inside Telegram. Here the stub has the real Mini App chrome
  // (MainButton/BackButton/openTelegramLink) and records every call.
  test("works with Telegram's native buttons and opens t.me links via the Mini App API", async ({
    browser,
  }) => {
    const ctx = await browser.newContext({ userAgent: UA });
    const data = initData(tgId + 2, "Bobur");
    await ctx.route("https://telegram.org/js/telegram-web-app.js*", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body: `(() => {
          const log = (window.__tg = { main: { visible: false, text: "", cb: null }, links: [] });
          const btn = (o) => ({ setParams(p) { if ("text" in p) o.text = p.text; if ("is_visible" in p) o.visible = p.is_visible; },
            onClick(cb) { o.cb = cb; }, offClick() { o.cb = null; }, show() { o.visible = true; }, hide() { o.visible = false; },
            showProgress() {}, hideProgress() {} });
          window.Telegram = { WebApp: { initData: ${JSON.stringify(data)}, ready() {}, expand() {},
            setHeaderColor() {}, setBackgroundColor() {}, MainButton: btn(log.main), BackButton: btn({}),
            HapticFeedback: { selectionChanged() {}, notificationOccurred() {} },
            openTelegramLink(u) { log.links.push(u); }, openLink(u) { log.links.push(u); } } };
        })();`,
      }),
    );
    const page = await ctx.newPage();
    type Tg = {
      __tg?: { main: { text: string; visible: boolean; cb: (() => void) | null }; links: string[] };
    };
    const main = () =>
      page.evaluate(() => (window as unknown as Tg).__tg?.main ?? { text: "", visible: false, cb: null });
    const press = () => page.evaluate(() => (window as unknown as Tg).__tg?.main.cb?.());
    const pressWhen = async (text: string) => {
      await expect.poll(async () => (await main()).text).toBe(text);
      await press();
    };

    await page.goto("/uz/tg");
    await expect(page).toHaveURL(/\/uz\/welcome/);
    await pressWhen("Boshladik!");
    await expect(page).toHaveURL(/\/uz\/onboarding/);
    await pickBirthDate(page, 10, 5, 1996);
    await pressWhen("Davom etamiz");
    await pressWhen("Davom etamiz");
    await pressWhen("Profilni saqlaymiz");
    // No requestContact in this client → bot link, opened through openTelegramLink (plain t.me links are ignored).
    await pressWhen("Botda tasdiqlayman");
    await expect
      .poll(() => page.evaluate(() => (window as unknown as Tg).__tg?.links))
      .toEqual([expect.stringMatching(/^https:\/\/t\.me\/e2e_test_bot\?start=phone$/)]);

    // A page without a main action: the stale native button is hidden after a full load.
    await page.goto("/uz/trips?all=1");
    await expect.poll(async () => (await main()).visible).toBe(false);

    // Sample trip (seed): "Men ham boraman!" is the native button and sends the request.
    await page.goto("/uz/trips/00000000-0000-4000-8000-000000000200");
    await pressWhen("Men ham boraman!");
    await expect(page.getByText("So'rovingiz yuborildi", { exact: false })).toBeVisible();
    await expect.poll(async () => (await main()).visible).toBe(false);
    await ctx.close();
  });

  // Shared link t.me/<bot>?startapp=trip_<code>: a newcomer sees the trip first, signs up after.
  test("startapp link opens the trip before onboarding", async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: UA });
    const data = initData(tgId + 3, "Lola", "trip_NAMUNA0");
    await ctx.route("https://telegram.org/js/telegram-web-app.js*", (r) =>
      r.fulfill({
        contentType: "text/javascript",
        body: `window.Telegram={WebApp:{initData:${JSON.stringify(data)},ready(){},expand(){}}};`,
      }),
    );
    const page = await ctx.newPage();
    await page.goto("/uz/tg");
    await expect(page).toHaveURL(/\/uz\/trips\/00000000-0000-4000-8000-000000000200$/);
    await expect(page.getByRole("heading", { level: 1, name: "Tbilisi va Kazbegi" })).toBeVisible();
    await page.getByRole("link", { name: "Qo'shilish uchun profilni to'ldiring" }).click();
    await expect(page).toHaveURL(/\/uz\/welcome\?next=/);
    await ctx.close();
  });

  test("profile API rejects cross-site posts", async ({ request }) => {
    const res = await request.post("/api/profile", {
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      data: {},
    });
    expect(res.status()).toBe(403);
  });
});
