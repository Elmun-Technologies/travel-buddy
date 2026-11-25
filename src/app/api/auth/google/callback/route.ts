import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { asLocale } from "@/lib/guard";
import { getSessionUser } from "@/lib/session";
import { exchangeCode, googleConfigured, googleRedirectUri } from "@/modules/auth/google";
import { completeGoogleLogin } from "@/modules/auth/login";
import { linkProvider } from "@/modules/auth/service";

export async function GET(req: NextRequest) {
  const jar = await cookies();
  const raw = jar.get("tb_gauth")?.value;
  jar.delete({ name: "tb_gauth", path: "/api/auth/google" });
  let saved: { state?: string; verifier?: string; locale?: string } = {};
  try {
    saved = JSON.parse(raw ?? "{}");
  } catch {}
  const locale = asLocale(saved.locale);
  const base = process.env.APP_URL || req.nextUrl.origin;
  const fail = (code = "failed") => Response.redirect(new URL(`/${locale}/login?error=${code}`, base), 303);

  const q = req.nextUrl.searchParams;
  const code = q.get("code");
  if (!googleConfigured() || !code || !saved.verifier || !saved.state || q.get("state") !== saved.state)
    return fail();
  const id = await exchangeCode(code, saved.verifier, googleRedirectUri(base));
  if (!id) return fail();

  // Already signed in (for example with Telegram): add Google to this account instead.
  const me = await getSessionUser();
  if (me) {
    const r = await linkProvider(me.id, "google", id.sub);
    return Response.redirect(new URL(`/${locale}/me${r === "taken" ? "?linked=taken" : ""}`, base), 303);
  }
  const res = await completeGoogleLogin(id, locale);
  return Response.redirect(
    new URL(
      res.ok ? res.next : `/${locale}/login?error=${res.error === "suspended" ? "suspended" : "failed"}`,
      base,
    ),
    303,
  );
}
