import { z } from "zod";
import { connection } from "next/server";
import { subscribeRoom } from "@/lib/room-events";
import { getSessionUser } from "@/lib/session";
import { getChat, listMessages, markRead, type RoomEvent } from "@/modules/chat/service";
import { isActiveUser } from "@/modules/users/service";

// Live updates of a 1:1 / lead conversation (Server-Sent Events); membership re-checked every 25 s.
export async function GET(req: Request, { params }: RouteContext<"/api/chats/[id]/stream">) {
  await connection();
  const id = z.uuid().safeParse((await params).id);
  const user = await getSessionUser();
  if (!id.success || !user) return new Response(null, { status: 401 });
  if (!(await getChat(user.id, id.data))) return new Response(null, { status: 403 });
  const convId = id.data;

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
        if (e.t !== "message") return;
        const [m] = await listMessages(convId, user.id, { ids: [e.id] }); // blocked senders filtered
        if (m) send("message", m);
      };
      const unsubscribe = subscribeRoom(convId, (e) => void onEvent(e).catch(() => {}));
      const ping = setInterval(async () => {
        const ok = await Promise.all([getChat(user.id, convId), isActiveUser(user.id)]).catch(() => null);
        if (!ok?.[0] || !ok[1]) return stop();
        await markRead(convId, user.id).catch(() => {});
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
      void markRead(convId, user.id).catch(() => {});
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
