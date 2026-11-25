import { z } from "zod";
import { pictureResponse } from "@/lib/media";
import { getSessionUser } from "@/lib/session";
import { messageImageKey } from "@/modules/chat/service";

// A picture sent in a chat: only for current members of that chat, never across a block.
export async function GET(_req: Request, { params }: RouteContext<"/api/media/message/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  const viewer = await getSessionUser();
  if (!id.success || !viewer) return new Response("Not found", { status: 404 });
  return pictureResponse(await messageImageKey(viewer.id, id.data), 3600);
}
