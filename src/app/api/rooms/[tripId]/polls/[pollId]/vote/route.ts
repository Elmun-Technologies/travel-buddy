import { z } from "zod";
import { json } from "@/lib/api";
import { roomJson } from "@/lib/room-api";
import { vote } from "@/modules/chat/service";

const body = z.object({ optionId: z.uuid() });

export async function POST(
  req: Request,
  { params }: RouteContext<"/api/rooms/[tripId]/polls/[pollId]/vote">,
) {
  const { tripId, pollId } = await params;
  const r = await roomJson(req, tripId);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.body);
  const p = z.uuid().safeParse(pollId);
  if (!b.success || !p.success) return json({ error: "invalid" }, 422);
  const ok = await vote(r.room.id, p.data, b.data.optionId, r.user.id);
  return ok ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
