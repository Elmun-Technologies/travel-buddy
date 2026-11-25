import { z } from "zod";
import { pictureResponse } from "@/lib/media";
import { getSessionUser } from "@/lib/session";
import { photoKeyFor } from "@/modules/memories/service";

// An album photo: only for people who were in that trip's group, never across a block.
export async function GET(_req: Request, { params }: RouteContext<"/api/media/photo/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  const viewer = await getSessionUser();
  if (!id.success || !viewer) return new Response("Not found", { status: 404 });
  return pictureResponse(await photoKeyFor(viewer.id, id.data), 3600);
}
