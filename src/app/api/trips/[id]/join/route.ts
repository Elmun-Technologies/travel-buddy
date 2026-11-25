import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/track";
import { requestJoin } from "@/modules/groups/service";

const body = z.object({ message: z.string().trim().max(500).optional() }).catch({});

// "Men ham boraman!" — a plain route (works from pages opened before a deploy, unlike Server Actions).
export async function POST(req: Request, { params }: RouteContext<"/api/trips/[id]/join">) {
  const tripId = z.uuid().safeParse((await params).id);
  if (!tripId.success) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 2_048);
  if (!r.ok) return r.res;
  const { user } = r.value;
  if (!(await rateLimit(`join:user:${user.id}`, 30, 3600))) return json({ error: "rate_limited" }, 429);
  const res = await requestJoin(user.id, tripId.data, body.parse(r.value.body).message || null);
  if (res.ok) track("join_requested", user.id);
  return res.ok ? json({ ok: true }) : json({ error: res.error }, 409);
}
