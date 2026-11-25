import { expect, test } from "@playwright/test";
import postgres from "postgres";
import sharp from "sharp";
import { onboard, signedLoginUrl } from "./helpers";

// Profile picture upload through the real form, and who may fetch it afterwards.
const dbUrl = process.env.DATABASE_URL;
const base = Math.floor(Math.random() * 1e9) + 6e9;

test.describe("uploads", () => {
  test.skip(!dbUrl, "needs DATABASE_URL");
  const sql = dbUrl ? postgres(dbUrl, { max: 1, onnotice: () => {} }) : null!;
  test.afterAll(async () => {
    const ids = sql`select user_id from auth_accounts where provider='telegram' and provider_user_id = ${String(base + 1)}`;
    await sql`delete from users where id in (${ids})`;
    await sql.end();
  });

  test("a profile picture is shrunk, shown, and visible only to signed-in people", async ({
    browser,
    playwright,
  }) => {
    const page = await (await browser.newContext()).newPage();
    await page.goto(signedLoginUrl(base + 1, "Zarina"));
    await onboard(page, "Zarina");
    const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#cc3366" } })
      .png()
      .toBuffer();

    await page.goto("/uz/profile/edit");
    await page.waitForLoadState("networkidle");
    await page
      .getByLabel("Rasm tanlash")
      .setInputFiles({ name: "me.png", mimeType: "image/png", buffer: png });
    await expect(page.getByRole("button", { name: "Rasmni almashtirish" })).toBeVisible();

    const [{ id }] =
      await sql`select user_id as id from auth_accounts where provider='telegram' and provider_user_id = ${String(base + 1)}`;
    const mine = await page.request.get(`/api/media/avatar/${id}`);
    expect(mine.status()).toBe(200);
    expect(mine.headers()["content-type"]).toBe("image/webp");
    const meta = await sharp(await mine.body()).metadata();
    expect([meta.width, meta.height]).toEqual([1080, 1080]);
    expect((await mine.body()).length).toBeLessThan(300 * 1024);

    // a stranger without a session gets nothing
    const anon = await playwright.request.newContext({ baseURL: new URL(page.url()).origin });
    expect((await anon.get(`/api/media/avatar/${id}`)).status()).toBe(404);

    // a cross-site upload is refused
    const bad = await page.request.post("/api/profile/avatar", {
      headers: { origin: "https://evil.example" },
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: png } },
    });
    expect(bad.status()).toBe(403);

    // not a picture
    const notImage = await page.request.post("/api/profile/avatar", {
      headers: { origin: new URL(page.url()).origin },
      multipart: {
        file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<script>alert(1)</script>") },
      },
    });
    expect(notImage.status()).toBe(422);
  });
});
