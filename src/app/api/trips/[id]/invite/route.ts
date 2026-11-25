import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { inviteCandidate } from "@/modules/matching/jobs";

const body = z.object({ userId: z.uuid() });

// "Taklif yuborish": the organizer invites someone whose note fits the trip.
export async function POST(req: Request, { params }: RouteContext<"/api/trips/[id]/invite">) {
  const tripId = z.uuid().safeParse((await params).id);
  if (!tripId.success) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 256);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`invite:user:${r.value.user.id}`, 20, 86_400)))
    return json({ error: "rate_limited" }, 429);
  const res = await inviteCandidate(getDb(), r.value.user.id, tripId.data, b.data.userId);
  return res === "ok" ? json({ ok: true }) : json({ error: res }, res === "already" ? 409 : 404);
}
