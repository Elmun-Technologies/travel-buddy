import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { asLocale } from "@/lib/guard";
import { authorizeUrl, googleConfigured, googleRedirectUri, newPkce } from "@/modules/auth/google";

// "Google bilan kirish": remember a one-time state and PKCE secret for ten minutes, then go to Google.
export async function GET(req: NextRequest) {
  const locale = asLocale(req.nextUrl.searchParams.get("locale"));
  const base = process.env.APP_URL || req.nextUrl.origin;
  if (!googleConfigured()) return Response.redirect(new URL(`/${locale}/login?error=failed`, base), 303);
  const { state, verifier, challenge } = newPkce();
  (await cookies()).set("tb_gauth", JSON.stringify({ state, verifier, locale }), {
    httpOnly: true,
    secure: base.startsWith("https://"),
    sameSite: "lax", // the return from Google is a top-level navigation
    path: "/api/auth/google",
    maxAge: 600,
  });
  return Response.redirect(
    authorizeUrl({ state, challenge, locale, redirectUri: googleRedirectUri(base) }),
    303,
  );
}
