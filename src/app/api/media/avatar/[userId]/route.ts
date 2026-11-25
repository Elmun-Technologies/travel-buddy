import { z } from "zod";
import { pictureResponse } from "@/lib/media";
import { getSessionUser } from "@/lib/session";
import { avatarKeyFor } from "@/modules/profiles/service";

// Pictures are for signed-in people only, and never across a block.
export async function GET(_req: Request, { params }: RouteContext<"/api/media/avatar/[userId]">) {
  const id = z.uuid().safeParse((await params).userId);
  const viewer = await getSessionUser();
  if (!id.success || !viewer) return new Response("Not found", { status: 404 });
  return pictureResponse(await avatarKeyFor(viewer.id, id.data));
}
