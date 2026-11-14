import { createHash, createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";

export const TOKEN = process.env.E2E_BOT_TOKEN ?? "1:e2e-test-token";

/** Telegram Login Widget callback URL, signed with the test bot token. */
export function signedLoginUrl(id: number, name: string) {
  const f: Record<string, string> = {
    id: String(id),
    first_name: name,
    auth_date: String(Math.floor(Date.now() / 1000)),
  };
  const check = Object.keys(f)
    .sort()
    .map((k) => `${k}=${f[k]}`)
    .join("\n");
  const hash = createHmac("sha256", createHash("sha256").update(TOKEN).digest()).update(check).digest("hex");
  return `/api/auth/telegram/callback?locale=uz&${new URLSearchParams({ ...f, hash })}`;
}

/** Welcome → 4-step onboarding (web fallback buttons) → trips. Phone left unverified ("Keyinroq"). */
export async function onboard(page: Page, name: string) {
  await expect(page).toHaveURL(/\/uz\/welcome/);
  await page.getByRole("link", { name: "Boshladik!" }).click();
  await expect(page).toHaveURL(/\/uz\/onboarding/);
  await page.waitForLoadState("networkidle"); // hydrated: typing before that is not seen by React
  await expect(page.locator("#displayName")).toHaveValue(name);
  await pickBirthDate(page, 15, 6, 1997);
  await page.getByRole("button", { name: "Davom etamiz", exact: true }).click();
  await page.getByRole("button", { name: "Tog' va trekking" }).click();
  await page.getByRole("button", { name: "Davom etamiz · 1 ta tanlandi" }).click();
  await page.getByRole("button", { name: "Profilni saqlaymiz" }).click();
  await page.getByRole("link", { name: "Keyinroq" }).click();
  await expect(page).toHaveURL(/\/uz\/trips$/);
}

/** Onboarding step 1: Day | Month | Year selects. */
export async function pickBirthDate(page: Page, day: number, month: number, year: number) {
  await page.selectOption("#birthDay", String(day));
  await page.selectOption("#birthMonth", String(month));
  await page.selectOption("#birthYear", String(year));
}
