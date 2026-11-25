import { createHash, randomBytes } from "node:crypto";

// Sign in with Google (OAuth 2.0 authorization code + PKCE). Off until GOOGLE_CLIENT_ID and
// GOOGLE_CLIENT_SECRET are set. The ID token arrives straight from Google's token endpoint over TLS,
// so (as OpenID Connect allows) its claims are checked, not its signature.

export const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirectUri = (base: string) => `${base.replace(/\/$/, "")}/api/auth/google/callback`;

const b64url = (b: Buffer) => b.toString("base64url");

export function newPkce() {
  const verifier = b64url(randomBytes(32));
  return {
    state: b64url(randomBytes(16)),
    verifier,
    challenge: b64url(createHash("sha256").update(verifier).digest()),
  };
}

export function authorizeUrl(p: { state: string; challenge: string; redirectUri: string; locale: string }) {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: p.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    hl: p.locale,
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export type GoogleIdentity = { sub: string; email: string | null; name: string | null };

/** Claims of an ID token we just received from Google, or null if they do not add up. */
export function readIdToken(idToken: string, clientId: string, now = Date.now()): GoogleIdentity | null {
  try {
    const claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString()) as Record<
      string,
      unknown
    >;
    const issuerOk = claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com";
    const audOk = claims.aud === clientId;
    const fresh = typeof claims.exp === "number" && claims.exp * 1000 > now;
    if (!issuerOk || !audOk || !fresh || typeof claims.sub !== "string" || !claims.sub) return null;
    return {
      sub: claims.sub,
      email: claims.email_verified === true && typeof claims.email === "string" ? claims.email : null,
      name: typeof claims.name === "string" ? claims.name.slice(0, 50) : null,
    };
  } catch {
    return null;
  }
}

export async function exchangeCode(
  code: string,
  verifier: string,
  redirectUri: string,
): Promise<GoogleIdentity | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { id_token?: string } | null;
  return data?.id_token ? readIdToken(data.id_token, process.env.GOOGLE_CLIENT_ID!) : null;
}
