import "server-only";
import { headers } from "next/headers";
import type { Locale } from "@/i18n/routing";
import { rateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { getOwnProfile } from "@/modules/profiles/service";
import { loginWithTelegram } from "./service";
import type { TelegramUser } from "./telegram";

export const botToken = () => process.env.TELEGRAM_BOT_TOKEN ?? "";

export async function clientMeta() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
    userAgent: h.get("user-agent") ?? undefined,
  };
}

/** Shared by widget callback and Mini App: rate-limit, upsert user, set cookie, pick next page. */
export async function completeTelegramLogin(tg: TelegramUser, locale: Locale) {
  const meta = await clientMeta();
  if (!(await rateLimit(`login:ip:${meta.ip}`, 30, 600)))
    return { ok: false as const, error: "rate_limited" };
  const res = await loginWithTelegram(tg, locale);
  if (!res.ok) return res;
  await createSession(res.userId, meta);
  const hasProfile = !!(await getOwnProfile(res.userId));
  const name = encodeURIComponent((tg.first_name ?? "").slice(0, 50));
  return { ok: true as const, next: hasProfile ? `/${locale}/home` : `/${locale}/welcome?name=${name}` };
}
