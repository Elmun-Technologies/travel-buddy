import "server-only";
import { getSessionUser, type SessionUser } from "./session";

type Ok<T> = { ok: true; value: T };
type Err = { ok: false; res: Response };

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });

const originHost = (origin: string | null) => {
  try {
    return origin ? new URL(origin).host : null; // "null" origin (sandboxed/privacy) → reject
  } catch {
    return null;
  }
};

/**
 * Guard for state-changing JSON routes: same-origin only (the session cookie is SameSite=None
 * for the Telegram iframe, so we must reject cross-site posts ourselves), JSON body, signed-in user.
 */
export async function authedJson(
  req: Request,
  maxBytes = 16_384,
): Promise<Ok<{ user: SessionUser; body: unknown }> | Err> {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host || originHost(origin) !== host) return { ok: false, res: json({ error: "forbidden" }, 403) };
  if (!req.headers.get("content-type")?.startsWith("application/json"))
    return { ok: false, res: json({ error: "invalid" }, 415) };
  const user = await getSessionUser();
  if (!user) return { ok: false, res: json({ error: "unauthorized" }, 401) };
  const text = await req.text();
  if (text.length > maxBytes) return { ok: false, res: json({ error: "too_big" }, 413) };
  try {
    return { ok: true, value: { user, body: JSON.parse(text) } };
  } catch {
    return { ok: false, res: json({ error: "invalid" }, 400) };
  }
}
