import type { NextRequest } from "next/server";
import { asLocale } from "@/lib/guard";
import { botToken, completeTelegramLogin } from "@/modules/auth/login";
import { verifyLoginWidget } from "@/modules/auth/telegram";

// Telegram Login Widget redirects here with signed user fields (data-auth-url).
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const locale = asLocale(params.get("locale"));
  const base = process.env.APP_URL || req.nextUrl.origin;
  const tg = botToken() ? verifyLoginWidget(params, botToken()) : null;
  if (!tg) return Response.redirect(new URL(`/${locale}/login?error=failed`, base), 303);
  const res = await completeTelegramLogin(tg, locale);
  const to = res.ok
    ? res.next
    : `/${locale}/login?error=${res.error === "suspended" ? "suspended" : "failed"}`;
  return Response.redirect(new URL(to, base), 303);
}
