import { z } from "zod";
import { connection } from "next/server";
import { json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { roomJson } from "@/lib/room-api";
import { getSessionUser } from "@/lib/session";
import { boardOp } from "@/modules/board/schema";
import { applyOp, getBoard } from "@/modules/board/service";
import { getRoom } from "@/modules/chat/service";
import { getTripView } from "@/modules/trips/service";

// Reja / Yig'amiz / Xarajat for room members. Pages refetch this on the live "board" event.
export async function GET(_req: Request, { params }: RouteContext<"/api/rooms/[tripId]/board">) {
  await connection();
  const tripId = z.uuid().safeParse((await params).tripId);
  const user = await getSessionUser();
  if (!tripId.success || !user) return json({ error: "unauthorized" }, 401);
  if (!(await getRoom(user.id, tripId.data))) return json({ error: "forbidden" }, 403);
  const board = await getBoard(tripId.data, user.id);
  return board ? json(board) : json({ error: "forbidden" }, 403);
}

export async function POST(req: Request, { params }: RouteContext<"/api/rooms/[tripId]/board">) {
  const r = await roomJson(req, (await params).tripId);
  if (!r.ok) return r.res;
  const op = boardOp.safeParse(r.body);
  if (!op.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`board:user:${r.user.id}`, 120, 600))) return json({ error: "rate_limited" }, 429);
  const trip = await getTripView(r.tripId, r.user.id);
  if (!trip) return json({ error: "not_found" }, 404);
  const ok = await applyOp(
    { tripId: r.tripId, conversationId: r.room.id, userId: r.user.id, organizerId: trip.ownerUserId },
    op.data,
  );
  return ok ? json({ ok: true }) : json({ error: "forbidden" }, 403);
}
