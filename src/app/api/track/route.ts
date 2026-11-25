import { z } from "zod";
import { after } from "next/server";
import { clientIp, json } from "@/lib/api";
import { personId, sendEvent } from "@/lib/analytics";
import { rateLimit } from "@/lib/rate-limit";
import { getSessionUser } from "@/lib/session";

const short = (n: number) => z.string().trim().max(n).optional();
const body = z.object({
  event: z.enum(["pageview", "share_clicked"]),
  path: z.string().max(200).startsWith("/"),
  referrer: short(200),
  anon: z.string().regex(/^[a-f0-9]{8,32}$/),
  utm_source: short(60),
  utm_medium: short(60),
  utm_campaign: short(60),
  channel: short(20),
  object: short(20),
});

/** Browser → our server → PostHog. Same-origin only, tiny, rate-limited per address. */
export async function POST(req: Request) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let origin: string | null = null;
  try {
    origin = new URL(req.headers.get("origin") ?? "").host;
  } catch {}
  if (!host || origin !== host) return json({ error: "forbidden" }, 403);
  if (Number(req.headers.get("content-length") ?? 0) > 2048) return json({ error: "too_big" }, 413);
  if (!(await rateLimit(`track:ip:${clientIp(req.headers)}`, 120, 60))) return json({ ok: true }); // drop quietly
  const b = body.safeParse(await req.json().catch(() => null));
  if (!b.success) return json({ error: "invalid" }, 422);
  const user = await getSessionUser();
  const { event, anon, ...props } = b.data;
  const who = user ? personId(user.id) : `anon_${anon}`;
  after(() => sendEvent(event, who, { ...props, signed_in: !!user }));
  return json({ ok: true });
}
