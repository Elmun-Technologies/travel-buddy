import { z } from "zod";
import { json } from "@/lib/api";
import { roomJson } from "@/lib/room-api";
import { setPinned } from "@/modules/chat/service";
import { getTripView } from "@/modules/trips/service";

const body = z.object({ text: z.string().trim().max(200).nullable() });

// Only the organizer pins the announcement ("E'LON").
export async function PUT(req: Request, { params }: RouteContext<"/api/rooms/[tripId]/pin">) {
  const r = await roomJson(req, (await params).tripId);
  if (!r.ok) return r.res;
  const trip = await getTripView(r.tripId, r.user.id);
  if (!trip?.isOwner) return json({ error: "forbidden" }, 403);
  const b = body.safeParse(r.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  await setPinned(r.room.id, b.data.text || null, r.user.id);
  return json({ ok: true });
}
