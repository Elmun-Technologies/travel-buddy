import "server-only";
import { z } from "zod";
import { authedJson, json } from "./api";
import { getRoom } from "@/modules/chat/service";

/** JSON write to a trip room: same-origin, signed in, and a current member of that room. */
export async function roomJson(req: Request, tripIdRaw: string, maxBytes = 4_096) {
  const tripId = z.uuid().safeParse(tripIdRaw);
  if (!tripId.success) return { ok: false as const, res: json({ error: "not_found" }, 404) };
  const r = await authedJson(req, maxBytes);
  if (!r.ok) return r;
  const room = await getRoom(r.value.user.id, tripId.data);
  if (!room) return { ok: false as const, res: json({ error: "forbidden" }, 403) };
  return { ok: true as const, user: r.value.user, body: r.value.body, room, tripId: tripId.data };
}
