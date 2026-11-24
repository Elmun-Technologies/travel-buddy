import { routing } from "@/i18n/routing";
import { asLocale } from "@/lib/guard";
import { botToken, completeTelegramLogin } from "@/modules/auth/login";
import { verifyWebAppInitData } from "@/modules/auth/telegram";
import { getTripIdByCode } from "@/modules/trips/service";

// Mini App: client posts Telegram.WebApp.initData; we verify the HMAC server-side.
export async function POST(req: Request) {
  // Same-origin JSON only, small body: a cross-site form post must not be able to sign a victim in
  // to someone else's account, and nobody gets to stream us a huge unauthenticated body.
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(req.headers.get("origin") ?? "").host;
  } catch {}
  if (!host || originHost !== host || !req.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "forbidden" }, { status: 403 });
  if (Number(req.headers.get("content-length") ?? 0) > 8192)
    return Response.json({ error: "too_big" }, { status: 413 });
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
  // Opened from a shared link (t.me/<bot>?startapp=trip_<code>): show that trip first —
  // a newcomer sees the trip before onboarding (product-decisions §3). start_param is signed.
  const code = /^trip_([0-9A-Z]{6,8})$/.exec(new URLSearchParams(initData).get("start_param") ?? "")?.[1];
  const tripId = code ? await getTripIdByCode(code) : null;
  return Response.json({ next: tripId ? `/${locale}/trips/${tripId}` : res.next });
}
