import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { memberInvite, startLink, unlinkGroup } from "@/modules/telegram-group/service";

const body = z.object({ op: z.enum(["code", "unlink", "invite"]) });

// The trip's own Telegram group: one-time code (organizer), unlink (organizer), personal invite (members).
export async function POST(req: Request, { params }: RouteContext<"/api/trips/[id]/telegram">) {
  const tripId = z.uuid().safeParse((await params).id);
  if (!tripId.success) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 256);
  if (!r.ok) return r.res;
  const { user } = r.value;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`tggroup:user:${user.id}`, 30, 3600))) return json({ error: "rate_limited" }, 429);
  if (b.data.op === "code") {
    const code = await startLink(user.id, tripId.data);
    return code ? json({ code }) : json({ error: "forbidden" }, 403);
  }
  if (b.data.op === "unlink")
    return (await unlinkGroup(user.id, tripId.data)) ? json({ ok: true }) : json({ error: "forbidden" }, 403);
  const res = await memberInvite(user.id, tripId.data);
  return res.ok
    ? json({ link: res.link })
    : json({ error: res.error }, res.error === "not_linked" ? 404 : 409);
}
