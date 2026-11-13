import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyLoginWidget, verifyWebAppInitData } from "./telegram";

const TOKEN = "123456:TEST_TOKEN";
const NOW = 1_800_000_000;

function signWidget(fields: Record<string, string>) {
  const check = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const hash = createHmac("sha256", createHash("sha256").update(TOKEN).digest()).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash });
}

function signInitData(fields: Record<string, string>) {
  const check = Object.entries(fields)
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(TOKEN).digest();
  const hash = createHmac("sha256", secret).update(check).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

describe("verifyLoginWidget", () => {
  const fields = { id: "42", first_name: "Ali", username: "ali", auth_date: String(NOW - 10) };

  it("accepts a valid signature and ignores our own extra params", () => {
    const p = signWidget(fields);
    p.set("locale", "ru");
    expect(verifyLoginWidget(p, TOKEN, NOW)).toMatchObject({ id: 42, first_name: "Ali" });
  });

  it("rejects tampered data, wrong token and stale auth_date", () => {
    const p = signWidget(fields);
    p.set("id", "43");
    expect(verifyLoginWidget(p, TOKEN, NOW)).toBeNull();
    expect(verifyLoginWidget(signWidget(fields), "other:token", NOW)).toBeNull();
    expect(verifyLoginWidget(signWidget(fields), TOKEN, NOW + 25 * 3600)).toBeNull();
    expect(verifyLoginWidget(new URLSearchParams(fields), TOKEN, NOW)).toBeNull();
  });
});

describe("verifyWebAppInitData", () => {
  const user = JSON.stringify({ id: 7, first_name: "Malika", language_code: "ru" });
  const fields = { query_id: "q1", user, auth_date: String(NOW - 5), signature: "sig" };

  it("accepts valid initData", () => {
    expect(verifyWebAppInitData(signInitData(fields), TOKEN, NOW)).toMatchObject({
      id: 7,
      language_code: "ru",
    });
  });

  it("rejects tampered user, stale data and garbage", () => {
    const tampered = new URLSearchParams(signInitData(fields));
    tampered.set("user", JSON.stringify({ id: 8 }));
    expect(verifyWebAppInitData(tampered.toString(), TOKEN, NOW)).toBeNull();
    expect(verifyWebAppInitData(signInitData(fields), TOKEN, NOW + 2 * 86400)).toBeNull();
    expect(verifyWebAppInitData("hash=abc", TOKEN, NOW)).toBeNull();
  });
});
