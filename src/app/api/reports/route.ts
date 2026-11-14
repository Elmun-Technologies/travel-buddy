import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { createReport, REPORT_REASONS } from "@/modules/moderation/service";

const body = z.object({
  targetType: z.enum(["user", "trip", "message"]),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
});

// "Shikoyat qilish" on profiles, trips, messages. The moderation queue lives in the admin panel.
export async function POST(req: Request) {
  const r = await authedJson(req, 1_024);
  if (!r.ok) return r.res;
  const parsed = body.safeParse(r.value.body);
  if (!parsed.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`report:user:${r.value.user.id}`, 20, 86_400)))
    return json({ error: "rate_limited" }, 429);
  await createReport(r.value.user.id, parsed.data.targetType, parsed.data.targetId, parsed.data.reason);
  return json({ ok: true });
}
