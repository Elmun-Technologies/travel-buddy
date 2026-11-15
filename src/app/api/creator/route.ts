import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { creatorEnabled, joinCreator, submitReel } from "@/modules/creator/service";

const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("join"), tripId: z.uuid() }),
  z.object({
    op: z.literal("reel"),
    id: z.uuid(),
    instagram: z
      .string()
      .trim()
      .regex(/^@?[A-Za-z0-9._]{1,30}$/)
      .transform((s) => `@${s.replace(/^@/, "")}`),
    reelUrl: z
      .url({ protocol: /^https$/ })
      .refine((u) => /^https:\/\/(www\.)?instagram\.com\/(reel|reels|p)\/[\w-]+/.test(u)),
  }),
]);

/** 1M Safar: "Qatnashaman" and the Reel link. 404 while the program is switched off. */
export async function POST(req: Request) {
  if (!creatorEnabled()) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 1_024);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  const userId = r.value.user.id;
  if (!(await rateLimit(`creator:user:${userId}`, 20, 600))) return json({ error: "rate_limited" }, 429);
  const op = b.data;
  if (op.op === "join") {
    const res = await joinCreator(userId, op.tripId);
    return res === "ok" ? json({ ok: true }) : json({ error: res }, 409);
  }
  return (await submitReel(userId, op.id, op.instagram, op.reelUrl))
    ? json({ ok: true })
    : json({ error: "closed" }, 409);
}
