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
    await sql`delete from reports where reporter_id in (${ids})`;
    await sql`delete from trips where owner_user_id in (${ids})`;
    await sql`delete from users where id in (${ids})`;
    await sql.end();
  });

  test("organizer creates a trip, traveler requests, organizer approves", async ({ browser }) => {
    test.setTimeout(90_000); // the whole journey: create, share, join, room, plan, booking, costs
    const owner = await loginAndOnboard(browser, base + 1, "Malika");

    // Unverified phone → the creation flow asks for the phone first.
    await owner.goto("/uz/trips/new");
    await expect(owner.getByText("Avval telefonni tasdiqlaymiz")).toBeVisible();
    await sql`update users set phone_verified = true, phone = ${`+99891${String(base).slice(-7)}`}
      where id = (select user_id from auth_accounts where provider='telegram' and provider_user_id=${String(base + 1)})`;

    // 3 steps (App-CreateTrip): where & when → who & how → ready + share.
    await owner.reload();
    await owner.waitForLoadState("networkidle");
    await owner.getByRole("button", { name: "Gruziya" }).click();
    await owner.getByRole("button", { name: "Aniq sana" }).click();
    await owner.getByLabel("Boshlanish").fill(plusDays(30));
    await owner.getByLabel("Tugash").fill(plusDays(35));
    await owner.getByRole("button", { name: "Keyingisi" }).click();
    for (let i = 0; i < 3; i++) await owner.getByRole("button", { name: "−" }).click(); // 6 → 3 people
    await owner.getByRole("button", { name: "Safarni ochamiz" }).click();
    await expect(owner.getByText("Safaringiz tayyor!", { exact: false })).toBeVisible();
    await expect(owner.getByRole("button", { name: /Havolani nusxalash/ })).toBeVisible();
    const title = "Gruziya · 6 kun";
    await owner.getByRole("link", { name: "Guruh xonasiga o'tamiz" }).click();
    await expect(owner).toHaveURL(/\/uz\/trips\/[0-9a-f-]{36}\/room$/);
    const tripUrl = owner.url().replace(/\/room$/, "");
    await owner.goto(tripUrl);
    await expect(owner.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(owner.getByText("Yangi so'rov yo'q.")).toBeVisible();
    const tripId = tripUrl.split("/").pop()!;

    // Short link, OG picture and story picture.
    const [{ code }] = await sql`select public_code as code from trips where id = ${tripId}`;
    await owner.goto(`/uz/t/${code}`);
    await expect(owner).toHaveURL(new RegExp(`/uz/trips/${tripId}$`));
    const og = new URL((await owner.locator('meta[property="og:image"]').getAttribute("content"))!);
    for (const path of [og.pathname + og.search, `/api/trips/${tripId}/story?locale=uz`]) {
      const img = await owner.request.get(path);
      expect(img.status(), path).toBe(200);
      expect(img.headers()["content-type"]).toContain("image/png");
    }

    const traveler: Page = await loginAndOnboard(browser, base + 2, "Aziz");
    await traveler.goto("/uz/trips?all=1&country=GE");
    await expect(traveler.getByRole("heading", { name: /Gruziya: \d+ ta safar topildi/ })).toBeVisible();
    await traveler.getByText(title).first().click();
    await traveler.getByRole("button", { name: "Shikoyat qilish" }).click();
    await traveler.getByRole("button", { name: "Soxta e'lon" }).click();
    await expect(traveler.getByText("Rahmat. 24 soat ichida", { exact: false })).toBeVisible();
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

    // Trip room: live chat (SSE), pinned notice, poll — both sides see updates without reloading.
    await owner.goto(`${tripUrl}/room`);
    await owner.waitForLoadState("networkidle");
    await traveler.getByRole("link", { name: "Guruh xonasiga kirish" }).click();
    await expect(traveler).toHaveURL(/\/room$/);
    await traveler.waitForLoadState("networkidle");
    await traveler.getByLabel("Guruhga yozing").fill("Salom, men ham shu yerdaman");
    await traveler.getByRole("button", { name: "Yuborish" }).click();
    await expect(owner.getByText("Salom, men ham shu yerdaman")).toBeVisible();

    await owner.getByRole("button", { name: "Yana" }).click();
    await owner.getByRole("button", { name: "E'lon qadash" }).click();
    await owner.getByLabel("E'lon qadash").fill("Uchrashuv 06:00, aeroport");
    await owner.getByRole("button", { name: "Saqlash" }).click();
    await expect(traveler.getByText("Uchrashuv 06:00, aeroport")).toBeVisible();

    await owner.getByRole("button", { name: "Yana" }).click();
    await owner.getByRole("button", { name: "So'rovnoma" }).click();
    await owner.getByLabel(/^Savol/).fill("Qayerda qolamiz?");
    await owner.getByLabel("1-variant").fill("Mehmon uyi");
    await owner.getByLabel("2-variant").fill("Mehmonxona");
    await owner.getByRole("button", { name: "Saqlash" }).click();
    await traveler.getByRole("button", { name: /Mehmon uyi/ }).click();
    await expect(owner.getByText("1 ovoz")).toBeVisible();

    // Reja: a member's suggestion waits for the organizer.
    await owner.getByRole("tab", { name: "Reja" }).click();
    await traveler.getByRole("tab", { name: "Reja" }).click();
    await traveler.getByRole("button", { name: "+ Taklif" }).click();
    await traveler.getByLabel(/^Joy/).fill("Kazbegi");
    await traveler.getByRole("button", { name: "Saqlash" }).click();
    await expect(owner.getByText("Kazbegi")).toBeVisible(); // live
    await owner.getByRole("button", { name: "Qabul qilish" }).click();
    await expect(traveler.getByText("Taklif", { exact: true })).toBeHidden();

    // Yig'amiz: a stay option, a vote, the organizer books it -> the cost is split in Xarajat.
    await owner.getByRole("tab", { name: "Yig'amiz" }).click();
    await traveler.getByRole("tab", { name: "Yig'amiz" }).click();
    await expect(traveler.getByRole("link", { name: "Shu reysni qidiraman" })).toHaveAttribute(
      "href",
      /aviasales\.uz\/search\/TAS\d{4}TBS\d{4}1/,
    );
    await traveler.getByRole("button", { name: "+ Variant qo'shish" }).nth(1).click();
    await traveler.getByLabel(/^Nomi/).fill("Tog' mehmon uyi");
    await traveler.getByLabel("Necha kecha").fill("3");
    await traveler.getByLabel(/^Bir kecha narxi/).fill("25");
    await traveler.getByRole("button", { name: "Saqlash" }).click();
    await owner.getByRole("button", { name: /Tog' mehmon uyi/ }).click();
    await expect(traveler.getByRole("button", { name: /Tog' mehmon uyi/ })).toHaveText(/1$/); // live
    await owner.getByRole("button", { name: "Men band qilaman" }).click();
    await expect(owner.getByLabel("Jami summa, $")).toHaveValue("75");
    await owner.getByRole("button", { name: "Saqlash" }).click();
    await expect(traveler.getByText("Tanlandi")).toBeVisible();

    await traveler.getByRole("tab", { name: "Xarajat" }).click();
    await expect(traveler.getByText("$37.50").first()).toBeVisible();
    await traveler.getByRole("button", { name: "To'ladim" }).click();
    await traveler.getByRole("button", { name: "Ha, to'ladim" }).click();
    await owner.getByRole("tab", { name: "Xarajat" }).click();
    await expect(owner.getByText("Hammasi teng — hech kim qarz emas.")).toBeVisible();

    // Safety: SOS page from the room header, "Hammasi joyida", then the family page without login.
    await traveler.getByRole("link", { name: "Xavfsizlik va SOS" }).click();
    await expect(traveler).toHaveURL(/\/sos$/);
    await traveler.getByRole("button", { name: "Hammasi joyida — belgilash" }).click();
    await expect(traveler.getByRole("button", { name: /Hammasi joyida · .* da belgilandi/ })).toBeVisible();
    await expect(traveler.getByText("Politsiya, tez yordam, o't o'chirish")).toBeVisible(); // Gruziya: 112
    const token = await traveler.evaluate(async (tripId) => {
      const r = await fetch("/api/safety", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "family.create", tripId }),
      });
      return ((await r.json()) as { token: string }).token;
    }, tripId);
    const family = await (await browser.newContext()).newPage();
    await family.goto(`/uz/f/${token}`);
    await expect(family.getByText("Hammasi joyida", { exact: true })).toBeVisible();
    await expect(family.getByText("Malika · tashkilotchi")).toBeVisible();
    await expect(family.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

    // Bot notifications: each kind can be turned off in the profile, and it stays off.
    await owner.goto("/uz/me");
    await owner.waitForLoadState("networkidle");
    const chat = owner.getByRole("switch", { name: "Chat xabarlari" });
    await expect(chat).toHaveAttribute("aria-checked", "true");
    await chat.click();
    await expect(chat).toHaveAttribute("aria-checked", "false");
    await owner.waitForLoadState("networkidle");
    await owner.reload();
    await expect(owner.getByRole("switch", { name: "Chat xabarlari" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("bad signature does not log in", async ({ page }) => {
    await page.goto(signedLoginUrl(base + 3, "X").replace(/hash=[0-9a-f]+/, "hash=deadbeef"));
    await expect(page).toHaveURL(/\/uz\/login\?error=failed/);
  });
});
