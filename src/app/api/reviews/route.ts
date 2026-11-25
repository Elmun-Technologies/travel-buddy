import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/track";
import { submitReview } from "@/modules/reviews/service";

const body = z.object({
  tripId: z.uuid(),
  subjectId: z.uuid(),
  rating: z.int().min(1).max(5),
  body: z.string().trim().max(280).optional(),
});

// "Birga borganlarga baho": one rating per companion per finished trip.
export async function POST(req: Request) {
  const r = await authedJson(req, 1_024);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`review:user:${r.value.user.id}`, 60, 86_400)))
    return json({ error: "rate_limited" }, 429);
  const res = await submitReview(
    r.value.user.id,
    b.data.tripId,
    b.data.subjectId,
    b.data.rating,
    b.data.body || null,
  );
  if (!res.ok) return json({ error: res.error }, res.error === "forbidden" ? 403 : 404);
  track("review_submitted", r.value.user.id, { rating: b.data.rating });
  return json({ ok: true });
}
