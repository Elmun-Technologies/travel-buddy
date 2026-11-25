import type { NextRequest } from "next/server";
import { asLocale } from "@/lib/guard";
import { getSessionUser } from "@/lib/session";
import { botToken, completeTelegramLogin } from "@/modules/auth/login";
import { linkProvider, userIdByTelegram } from "@/modules/auth/service";
import { verifyLoginWidget } from "@/modules/auth/telegram";

// Telegram Login Widget redirects here with signed user fields (data-auth-url).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const locale = asLocale(params.get("locale"));
  const base = process.env.APP_URL || req.nextUrl.origin;
  const tg = botToken() ? verifyLoginWidget(params, botToken()) : null;
  if (!tg) return Response.redirect(new URL(`/${locale}/login?error=failed`, base), 303);
  // Signed in another way (Google) and this Telegram is not used anywhere yet: link it to this account.
  const me = await getSessionUser();
  if (me && !(await userIdByTelegram(tg.id))) {
    await linkProvider(me.id, "telegram", String(tg.id));
    return Response.redirect(new URL(`/${locale}/me`, base), 303);
  }
  const res = await completeTelegramLogin(tg, locale);
  const to = res.ok
    ? res.next
    : `/${locale}/login?error=${res.error === "suspended" ? "suspended" : "failed"}`;
  return Response.redirect(new URL(to, base), 303);
}
