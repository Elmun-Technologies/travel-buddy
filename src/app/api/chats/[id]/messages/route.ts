import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/track";
import { getChat, notifyDirect, sendMessage } from "@/modules/chat/service";

const body = z.object({ body: z.string().trim().min(1).max(2000) });

export async function POST(req: Request, { params }: RouteContext<"/api/chats/[id]/messages">) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 4_096);
  if (!r.ok) return r.res;
  const { user } = r.value;
  const chat = await getChat(user.id, id.data);
  if (!chat) return json({ error: "forbidden" }, 403);
  if (!chat.canWrite) return json({ error: "blocked" }, 403);
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await rateLimit(`msg:user:${user.id}`, 30, 60))) return json({ error: "rate_limited" }, 429);
  const msgId = await sendMessage(id.data, user.id, b.data.body);
  await notifyDirect(id.data, user.id);
  track("message_sent", user.id, { kind: chat.kind });
  return json({ id: msgId });
}
