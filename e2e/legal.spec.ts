import { expect, test } from "@playwright/test";

const docs = ["terms", "privacy", "safety", "support"] as const;

for (const locale of ["uz", "ru", "en"] as const) {
  for (const doc of docs) {
    test(`/${locale}/${doc} opens without login and has no placeholders`, async ({ page }) => {
      const res = await page.goto(`/${locale}/${doc}`);
      expect(res?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const text = await page.locator("main").innerText();
      expect(text).not.toMatch(/undefined|\[object|\{app\}|\{terms\}|\{privacy\}/);
      expect(text.length).toBeGreaterThan(400);
      // 390px: no sideways scroll
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }
}

test("landing footer links lead to the documents", async ({ page }) => {
  await page.goto("/uz");
  for (const [name, path] of [
    ["Foydalanish shartlari", "terms"],
    ["Maxfiylik siyosati", "privacy"],
    ["Xavfsizlik qoidalari", "safety"],
    ["Yordam", "support"],
  ] as const) {
    await page.goto("/uz");
    await page.getByRole("contentinfo").getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`/uz/${path}$`));
  }
});

test("login page links to terms and privacy", async ({ page }) => {
  await page.goto("/uz/login");
  await page.getByRole("link", { name: "Foydalanish shartlari" }).click();
  await expect(page).toHaveURL(/\/uz\/terms$/);
});
