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

// Owner bug (4.1): "Показать" seemed dead in Telegram. Filters are now chips that navigate, show
// "searching…" and scroll to a results heading with the count.
test("feed chips filter by country and show the result count", async ({ page }) => {
  await page.goto("/ru/trips?all=1");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Страна" }).click();
  await page.getByRole("link", { name: "Грузия", exact: true }).click();
  await expect(page).toHaveURL(/country=GE/);
  await expect(page.getByRole("heading", { name: /^Грузия: / })).toBeVisible();
});

test("visa and real price pages open without login, with or without data", async ({ page }) => {
  await page.goto("/uz/visa");
  await expect(page.getByRole("heading", { name: "Qayerga osongina boramiz?" })).toBeVisible();
  await page.getByRole("link", { name: "Vizasiz", exact: true }).click();
  await expect(page).toHaveURL(/f=free/);
  const res = await page.goto("/uz/price/GE");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Haqiqiy narx" })).toBeVisible();
  await page.goto("/uz/price/XX"); // streamed page: the status is already 200, the content is the 404 page
  await expect(page.getByText("Sahifa topilmadi")).toBeVisible();
});
