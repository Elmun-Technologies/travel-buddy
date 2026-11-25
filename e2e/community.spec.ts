import { type Browser, expect, type Page, test } from "@playwright/test";
import postgres from "postgres";
import { onboard, signedLoginUrl } from "./helpers";

// Clubs, private chats and agency requests through the real UI (two signed-in people).
const dbUrl = process.env.DATABASE_URL;
const base = Math.floor(Math.random() * 1e9) + 7e9;
const plusDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function person(browser: Browser, id: number, name: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(signedLoginUrl(id, name));
  await onboard(page, name);
  return page;
}
/** Same people again in a later test: they already have a profile, so just sign in. */
async function again(browser: Browser, id: number, name: string) {
  const page = await (await browser.newContext()).newPage();
  await page.goto(signedLoginUrl(id, name));
  await expect(page).toHaveURL(/\/uz\/home$/);
  return page;
}
const origin = (p: Page) => new URL(p.url()).origin;
const api = (p: Page, path: string, data: unknown) =>
  p.request.post(path, { headers: { origin: origin(p), "content-type": "application/json" }, data });

test.describe("community", () => {
  test.skip(!dbUrl, "needs DATABASE_URL");
  test.describe.configure({ mode: "serial" });
  const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null!;
  const ids = () =>
    sql`select user_id from auth_accounts where provider='telegram' and provider_user_id in (${String(base + 1)}, ${String(base + 2)})`;
  const phone = (n: number) =>
    sql`update users set phone_verified = true, phone = ${`+99893${String(base + n).slice(-7)}`}
      where id = (select user_id from auth_accounts where provider='telegram' and provider_user_id=${String(base + n)})`;

  test.afterAll(async () => {
    await sql`delete from bookings where lead_id in (select id from leads where user_id in (${ids()}))`;
    await sql`delete from leads where user_id in (${ids()}) or agency_id in (select agency_id from agency_members where user_id in (${ids()}))`;
    await sql`delete from tour_offers where agency_id in (select agency_id from agency_members where user_id in (${ids()}))`;
    await sql`delete from trips where agency_id in (select agency_id from agency_members where user_id in (${ids()})) or owner_user_id in (${ids()})`;
    await sql`delete from agencies where id in (select agency_id from agency_members where user_id in (${ids()}))`;
    await sql`delete from clubs where owner_user_id in (${ids()})`;
    await sql`delete from users where id in (${ids()})`;
    await sql.end();
  });

  test("a club: open, join, post; a private chat between two people from one group", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await person(browser, base + 1, "Nodira");
    const b = await person(browser, base + 2, "Bobur");
    await phone(1);
    await phone(2);

    // Club: Nodira opens it in the UI, Bobur joins and writes a post.
    await a.goto("/uz/clubs/new");
    await a.waitForLoadState("networkidle");
    await a.getByLabel("Klub nomi").fill("TEST Tog' sayohatchilari");
    await a.getByRole("button", { name: "Klubni ochamiz" }).click();
    await expect(a).toHaveURL(/\/uz\/clubs\/[0-9a-f-]{36}$/);
    await expect(a.getByRole("heading", { name: "TEST Tog' sayohatchilari" })).toBeVisible();
    const clubUrl = a.url();
    await b.goto(clubUrl);
    await b.waitForLoadState("networkidle");
    await b.getByRole("button", { name: "Qo'shilish" }).click();
    await expect(b.getByText("Siz a'zosiz")).toBeVisible();
    await b.getByLabel("Klubga yangilik yozing").fill("Shanba kuni Chimganga boramizmi?");
    await b.getByRole("button", { name: "Yuborish", exact: true }).click();
    await expect(b.getByText("Shanba kuni Chimganga boramizmi?")).toBeVisible();
    await a.reload();
    await expect(a.getByText("Shanba kuni Chimganga boramizmi?")).toBeVisible();

    // A group of two: Nodira's trip, Bobur approved (set directly), then a private chat.
    const created = await api(a, "/api/trips", {
      locale: "uz",
      country: "GE",
      when: "exact",
      startDate: plusDays(30),
      endDate: plusDays(34),
      flex: false,
      size: 4,
      band: "any",
      styles: [],
      womenOnly: false,
    });
    expect(created.status()).toBe(200);
    const { id: tripId } = (await created.json()) as { id: string };
    await sql`insert into trip_members (trip_id, user_id, role, status)
      select ${tripId}, user_id, 'member', 'approved' from auth_accounts where provider='telegram' and provider_user_id=${String(base + 2)}`;
    const [{ aid }] =
      await sql`select user_id as aid from auth_accounts where provider='telegram' and provider_user_id=${String(base + 1)}`;

    await b.goto(`/uz/u/${aid}`);
    await b.waitForLoadState("networkidle");
    await b.getByRole("button", { name: "Yozish" }).click();
    await expect(b).toHaveURL(/\/uz\/chats\/[0-9a-f-]{36}$/);
    const chatUrl = b.url();
    await b.waitForLoadState("networkidle");
    await b.getByLabel("Xabar yozing").fill("Salom, Nodira!");
    const sent = b.waitForResponse((r) => r.url().includes("/messages") && r.request().method() === "POST");
    await b.getByRole("button", { name: "Yuborish", exact: true }).click();
    expect((await sent).status()).toBe(200);
    await a.goto(chatUrl);
    await a.waitForLoadState("networkidle");
    await expect(a.getByText("Salom, Nodira!")).toBeVisible();
    // live: her answer reaches him without reloading
    await a.getByLabel("Xabar yozing").fill("Salom, Bobur!");
    await a.getByRole("button", { name: "Yuborish", exact: true }).click();
    await expect(b.getByText("Salom, Bobur!")).toBeVisible();

    // an unrelated person cannot open it
    const c = await person(browser, base + 3, "Begona");
    await c.goto(chatUrl);
    await expect(c.getByText("Sahifa topilmadi")).toBeVisible();
    await sql`delete from users where id in (select user_id from auth_accounts where provider='telegram' and provider_user_id=${String(base + 3)})`;
  });

  test("an agency: register, get verified, publish a tour, take a request, accept", async ({ browser }) => {
    test.setTimeout(120_000);
    const a = await again(browser, base + 1, "Nodira");
    const b = await again(browser, base + 2, "Bobur");
    const reg = await api(a, "/api/agency", {
      op: "register",
      agency: { name: "TEST Agency", phone: "+998901112233", country: "UZ" },
    });
    expect(reg.status()).toBe(200);
    // the cabinet shows "under review"
    await a.goto("/uz/agency");
    await expect(a.getByText("Tekshiruvda")).toBeVisible();
    await sql`update agencies set status = 'verified' where id in (select agency_id from agency_members where user_id in
      (select user_id from auth_accounts where provider='telegram' and provider_user_id=${String(base + 1)}))`;

    const offer = await api(a, "/api/agency", {
      op: "offer.create",
      offer: {
        title: "TEST Gruziya 6 kun",
        destinationCountry: "GE",
        destinationCity: "Tbilisi",
        startDate: plusDays(40),
        endDate: plusDays(45),
        price: 550,
        currency: "USD",
        seats: 5,
        includes: ["Mehmonxona", "Transfer"],
        excludes: ["Aviachipta"],
        itinerary: [{ title: "1-kun", text: "Kelish" }],
        refundPolicy: "14 kun oldin to'liq qaytariladi",
      },
    });
    expect(offer.status()).toBe(200);
    const { id: tourId } = (await offer.json()) as { id: string };

    // Bobur sees the tour, price and programme, and sends a request
    await b.goto(`/uz/trips/${tourId}`);
    await expect(b.getByText("$550 / kishi")).toBeVisible();
    await expect(b.getByText("Mehmonxona")).toBeVisible();
    await b.waitForLoadState("networkidle");
    await b.getByRole("button", { name: "Ariza yuborish" }).click();
    await expect(b.getByText("Ariza yuborildi", { exact: false })).toBeVisible();

    // Nodira accepts in the cabinet; the phone appears, Bobur gets a chat
    await a.goto("/uz/agency");
    await a.waitForLoadState("networkidle");
    await expect(a.getByText("Bobur")).toBeVisible();
    await expect(a.getByText("Telefon:")).toHaveCount(0);
    await a.getByRole("button", { name: "Qabul qilish" }).first().click();
    await expect(a.getByText("Telefon:")).toBeVisible();
    await b.reload();
    await expect(b.getByText("Arizangiz qabul qilindi")).toBeVisible();
    await b.getByRole("link", { name: "Agentlik bilan chat" }).click();
    await expect(b).toHaveURL(/\/uz\/chats\//);
  });
});
