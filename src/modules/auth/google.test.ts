import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { authorizeUrl, newPkce, readIdToken } from "./google";

const token = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;
const now = Date.UTC(2026, 10, 25);
const ok = {
  iss: "https://accounts.google.com",
  aud: "cid",
  sub: "123",
  exp: now / 1000 + 600,
  email: "a@b.uz",
  email_verified: true,
  name: "Ali",
};

describe("Google sign-in helpers", () => {
  it("PKCE challenge is the SHA-256 of the verifier", () => {
    const p = newPkce();
    expect(p.challenge).toBe(createHash("sha256").update(p.verifier).digest("base64url"));
    expect(p.state).not.toBe(newPkce().state);
  });

  it("builds an authorization URL with state, PKCE and the openid scopes", () => {
    process.env.GOOGLE_CLIENT_ID = "cid";
    const u = new URL(
      authorizeUrl({ state: "s", challenge: "c", redirectUri: "https://x.uz/cb", locale: "uz" }),
    );
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(u.searchParams)).toMatchObject({
      client_id: "cid",
      response_type: "code",
      scope: "openid email profile",
      state: "s",
      code_challenge: "c",
      code_challenge_method: "S256",
    });
  });

  it("accepts a good token and keeps the email only when Google verified it", () => {
    expect(readIdToken(token(ok), "cid", now)).toEqual({ sub: "123", email: "a@b.uz", name: "Ali" });
    expect(readIdToken(token({ ...ok, email_verified: false }), "cid", now)?.email).toBeNull();
  });

  it("rejects wrong audience, issuer, expired and malformed tokens", () => {
    expect(readIdToken(token({ ...ok, aud: "other" }), "cid", now)).toBeNull();
    expect(readIdToken(token({ ...ok, iss: "https://evil.example" }), "cid", now)).toBeNull();
    expect(readIdToken(token({ ...ok, exp: now / 1000 - 1 }), "cid", now)).toBeNull();
    expect(readIdToken(token({ ...ok, sub: "" }), "cid", now)).toBeNull();
    expect(readIdToken("garbage", "cid", now)).toBeNull();
  });
});
