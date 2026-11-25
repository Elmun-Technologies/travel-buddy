import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { openDirect } from "@/modules/chat/service";

const body = z.object({ userId: z.uuid() });

// "Yozish": the one 1:1 conversation with someone from a group you were both in.
export async function POST(req: Request) {
  const r = await authedJson(req, 256);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`dmopen:user:${r.value.user.id}`, 30, 3600)))
    return json({ error: "rate_limited" }, 429);
  const res = await openDirect(r.value.user.id, b.data.userId);
  return res.ok ? json({ id: res.id }) : json({ error: res.error }, 403);
}
