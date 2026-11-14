import { routing } from "@/i18n/routing";
import { asLocale } from "@/lib/guard";
import { botToken, completeTelegramLogin } from "@/modules/auth/login";
import { verifyWebAppInitData } from "@/modules/auth/telegram";

// Mini App: client posts Telegram.WebApp.initData; we verify the HMAC server-side.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { initData?: unknown; locale?: unknown } | null;
  const initData = typeof body?.initData === "string" ? body.initData.slice(0, 4096) : "";
  const tg = initData && botToken() ? verifyWebAppInitData(initData, botToken()) : null;
  if (!tg) return Response.json({ error: "failed" }, { status: 401 });
  // The page's language (the bot opens /{chosen language}/tg), else the Telegram app language.
  const lang = typeof body?.locale === "string" ? body.locale : tg.language_code?.slice(0, 2);
  const locale = asLocale(routing.locales.find((l) => l === lang));
  const res = await completeTelegramLogin(tg, locale);
  if (!res.ok)
    return Response.json({ error: res.error }, { status: res.error === "rate_limited" ? 429 : 403 });
  return Response.json({ next: res.next });
}
