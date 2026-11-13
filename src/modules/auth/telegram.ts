// Pure Telegram signature checks (no DB, testable).
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

const MAX_AGE_SEC = 24 * 60 * 60;
const WIDGET_FIELDS = ["id", "first_name", "last_name", "username", "photo_url", "auth_date"];

function safeEqualHex(a: string, b: string) {
  const x = Buffer.from(a, "hex");
  const y = Buffer.from(b, "hex");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

function fresh(authDate: string | null | undefined, nowSec: number) {
  const t = Number(authDate);
  return Number.isFinite(t) && t <= nowSec + 60 && nowSec - t <= MAX_AGE_SEC;
}

/** Login Widget: https://core.telegram.org/widgets/login#checking-authorization */
export function verifyLoginWidget(
  params: URLSearchParams,
  botToken: string,
  nowSec = Math.floor(Date.now() / 1000),
): TelegramUser | null {
  const hash = params.get("hash");
  if (!hash || !fresh(params.get("auth_date"), nowSec)) return null;
  const check = WIDGET_FIELDS.filter((k) => params.has(k))
    .sort()
    .map((k) => `${k}=${params.get(k)}`)
    .join("\n");
  const secret = createHash("sha256").update(botToken).digest();
  if (!safeEqualHex(createHmac("sha256", secret).update(check).digest("hex"), hash)) return null;
  const id = Number(params.get("id"));
  if (!Number.isSafeInteger(id)) return null;
  return {
    id,
    first_name: params.get("first_name") ?? undefined,
    last_name: params.get("last_name") ?? undefined,
    username: params.get("username") ?? undefined,
  };
}

/** Mini App initData: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app */
export function verifyWebAppInitData(
  initData: string,
  botToken: string,
  nowSec = Math.floor(Date.now() / 1000),
): TelegramUser | null {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !fresh(params.get("auth_date"), nowSec)) return null;
  params.delete("hash");
  const check = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  if (!safeEqualHex(createHmac("sha256", secret).update(check).digest("hex"), hash)) return null;
  try {
    const user = JSON.parse(params.get("user") ?? "") as TelegramUser;
    return Number.isSafeInteger(user.id) ? user : null;
  } catch {
    return null;
  }
}
