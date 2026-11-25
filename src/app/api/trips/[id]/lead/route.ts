import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/track";
import { submitLead } from "@/modules/agencies/service";

const body = z.object({
  message: z.string().trim().max(500).optional(),
  people: z.int().min(1).max(20).default(1),
});

// "Ariza qoldirish" on an agency tour.
export async function POST(req: Request, { params }: RouteContext<"/api/trips/[id]/lead">) {
  const tripId = z.uuid().safeParse((await params).id);
  if (!tripId.success) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 2_048);
  if (!r.ok) return r.res;
  const { user } = r.value;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`lead:user:${user.id}`, 10, 3600))) return json({ error: "rate_limited" }, 429);
  const res = await submitLead(user.id, tripId.data, b.data.message || null, b.data.people);
  if (res.ok) track("lead_submitted", user.id);
  return res.ok ? json({ id: res.id }) : json({ error: res.error }, res.error === "not_found" ? 404 : 409);
}
