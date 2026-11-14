import { expect, test } from "@playwright/test";

test("root redirects to default locale /uz", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/uz$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");
});

for (const [locale, submit] of [
  ["uz", "Meni yozib qo'ying"],
  ["ru", "Запишите меня"],
  ["en", "Count me in"],
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
  await page.getByRole("button", { name: "Count me in", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("You're on the list");
});

for (const locale of ["uz", "ru", "en"]) {
  test(`Telegram login widget uses page language (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}/login`);
    await expect(page.locator('script[src*="telegram-widget.js"]')).toHaveAttribute("data-lang", locale);
  });
}

// Owner bug (4.1): "Показать" did nothing in Telegram — an invalid number in the budget field blocked
// the native form submit silently. Budget is now a fixed choice and the form has noValidate.
test("feed filter submits from the Russian page", async ({ page }) => {
  await page.goto("/ru/trips");
  await page.selectOption('select[name="country"]', "GE");
  await page.selectOption('select[name="budget"]', "600");
  await page.getByRole("button", { name: "Показать" }).click();
  await expect(page).toHaveURL(/country=GE.*budget=600/);
});
