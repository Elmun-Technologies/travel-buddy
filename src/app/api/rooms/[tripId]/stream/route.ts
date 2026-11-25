import { z } from "zod";
import { connection } from "next/server";
import { subscribeRoom } from "@/lib/room-events";
import { getSessionUser } from "@/lib/session";
import { isActiveUser } from "@/modules/users/service";
import { getPolls, getRoom, listMessages, markRead, type RoomEvent } from "@/modules/chat/service";

// Live room updates (Server-Sent Events). Membership is re-checked every 25 s with the keep-alive.
export async function GET(req: Request, { params }: RouteContext<"/api/rooms/[tripId]/stream">) {
  await connection();
  const tripId = z.uuid().safeParse((await params).tripId);
  const user = await getSessionUser();
  if (!tripId.success || !user) return new Response(null, { status: 401 });
  const room = await getRoom(user.id, tripId.data);
  if (!room) return new Response(null, { status: 403 });

  const enc = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (event: string, data: unknown) => {
        try {
          ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          stop();
        }
      };
      const onEvent = async (e: RoomEvent) => {
        if (e.t === "message") {
          const [m] = await listMessages(room.id, user.id, { ids: [e.id] }); // blocked senders filtered
          if (!m) return;
          const poll = m.pollId ? (await getPolls(room.id, [m.pollId], user.id))[m.pollId] : undefined;
          send("message", { ...m, poll });
        } else if (e.t === "poll") send("poll", (await getPolls(room.id, [e.id], user.id))[e.id]);
        else if (e.t === "board") send("board", {});
        else send("pin", { text: (await getRoom(user.id, tripId.data))?.pinnedText ?? null });
      };
      const unsubscribe = subscribeRoom(room.id, (e) => void onEvent(e).catch(() => {}));
      const ping = setInterval(async () => {
        // Still a member, and still a live account (suspended or deleted people are cut off).
        const ok = await Promise.all([getRoom(user.id, tripId.data), isActiveUser(user.id)]).catch(
          () => null,
        );
        if (!ok?.[0] || !ok[1]) return stop();
        await markRead(room.id, user.id).catch(() => {}); // open room = read: no chat digest
        try {
          ctrl.enqueue(enc.encode(": ping\n\n"));
        } catch {
          stop();
        }
      }, 25_000);
      stop = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          ctrl.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => stop());
      ctrl.enqueue(enc.encode("retry: 3000\n\n"));
      void markRead(room.id, user.id).catch(() => {});
    },
    cancel() {
      stop();
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
