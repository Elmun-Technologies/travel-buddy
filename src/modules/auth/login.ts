import "server-only";
import { headers } from "next/headers";
import type { Locale } from "@/i18n/routing";
import { clientIp } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createSession } from "@/lib/session";
import { track } from "@/lib/track";
import { getOwnProfile } from "@/modules/profiles/service";
import { loginWithGoogle, loginWithTelegram } from "./service";
import type { TelegramUser } from "./telegram";

export const botToken = () => process.env.TELEGRAM_BOT_TOKEN ?? "";

export async function clientMeta() {
  const h = await headers();
  return {
    ip: clientIp(h),
    userAgent: h.get("user-agent") ?? undefined,
  };
}

/** Shared by widget callback and Mini App: rate-limit, upsert user, set cookie, pick next page. */
export async function completeTelegramLogin(tg: TelegramUser, locale: Locale, source?: string) {
  const meta = await clientMeta();
  if (!(await rateLimit(`login:ip:${meta.ip}`, 30, 600)))
    return { ok: false as const, error: "rate_limited" };
  const res = await loginWithTelegram(tg, locale);
  if (!res.ok) return res;
  await createSession(res.userId, meta);
  if (res.isNew) track("signup", res.userId, { locale, source: source ?? "direct" });
  const hasProfile = !!(await getOwnProfile(res.userId));
  const name = encodeURIComponent((tg.first_name ?? "").slice(0, 50));
  return { ok: true as const, next: hasProfile ? `/${locale}/home` : `/${locale}/welcome?name=${name}` };
}

/** Google sign-in: same steps as Telegram (rate limit, account, session, next page). */
export async function completeGoogleLogin(
  g: { sub: string; email: string | null; name: string | null },
  locale: Locale,
) {
  const meta = await clientMeta();
  if (!(await rateLimit(`login:ip:${meta.ip}`, 30, 600)))
    return { ok: false as const, error: "rate_limited" };
  const res = await loginWithGoogle(g.sub, g.email, locale);
  if (!res.ok) return res;
  await createSession(res.userId, meta);
  if (res.isNew) track("signup", res.userId, { locale, source: "google" });
  const hasProfile = !!(await getOwnProfile(res.userId));
  const name = encodeURIComponent((g.name ?? "").slice(0, 50));
  return { ok: true as const, next: hasProfile ? `/${locale}/home` : `/${locale}/welcome?name=${name}` };
}
