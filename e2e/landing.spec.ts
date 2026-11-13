import { expect, test } from "@playwright/test";

test("root redirects to default locale /uz", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/uz$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");
});

for (const [locale, submit] of [
  ["uz", "Yozilish"],
  ["ru", "Записаться"],
  ["en", "Join"],
] as const) {
  test(`landing renders in ${locale} with waitlist form`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator("#contact")).toBeVisible();
    await expect(page.getByRole("button", { name: submit, exact: true })).toBeVisible();
  });
}

test("unknown page shows localized 404", async ({ page }) => {
  const res = await page.goto("/ru/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByText("Страница не найдена")).toBeVisible();
});

test("waitlist submit stores contact", async ({ page }) => {
  test.skip(!process.env.DATABASE_URL, "needs DATABASE_URL");
  await page.goto("/en?utm_source=e2e");
  await page.fill("#contact", `@e2e_${Date.now()}`);
  await page.getByText("Georgia", { exact: true }).click();
  await page.getByRole("button", { name: "Join", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("You're on the list");
});
