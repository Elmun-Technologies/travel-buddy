import { z } from "zod";
import { json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { roomJson } from "@/lib/room-api";
import { createPoll } from "@/modules/chat/service";

const body = z.object({
  question: z.string().trim().min(3).max(140),
  options: z.array(z.string().trim().min(1).max(60)).min(2).max(4),
});

export async function POST(req: Request, { params }: RouteContext<"/api/rooms/[tripId]/polls">) {
  const r = await roomJson(req, (await params).tripId);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`poll:user:${r.user.id}`, 10, 3600))) return json({ error: "rate_limited" }, 429);
  return json({ id: await createPoll(r.room.id, r.user.id, b.data.question, b.data.options) });
}
