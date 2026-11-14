import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { block } from "@/modules/moderation/service";

const body = z.object({ userId: z.uuid() });

// "Bloklash": the two people stop seeing each other everywhere (feed, chat, profiles).
export async function POST(req: Request) {
  const r = await authedJson(req, 512);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`block:user:${r.value.user.id}`, 50, 86_400)))
    return json({ error: "rate_limited" }, 429);
  await block(r.value.user.id, b.data.userId);
  return json({ ok: true });
}
