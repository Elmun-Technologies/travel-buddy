import { z } from "zod";
import { json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/track";
import { roomJson } from "@/lib/room-api";
import { sendMessage } from "@/modules/chat/service";

const body = z.object({ body: z.string().trim().min(1).max(2000) });

export async function POST(req: Request, { params }: RouteContext<"/api/rooms/[tripId]/messages">) {
  const r = await roomJson(req, (await params).tripId);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`msg:user:${r.user.id}`, 30, 60))) return json({ error: "rate_limited" }, 429);
  const id = await sendMessage(r.room.id, r.user.id, b.data.body);
  track("message_sent", r.user.id);
  return json({ id });
}
