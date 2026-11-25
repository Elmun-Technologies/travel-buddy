import { z } from "zod";
import { pictureResponse } from "@/lib/media";
import { publicPhotoKey } from "@/modules/memories/service";

// A photo of a public trip story: no login, but only while every member of that trip agrees.
export async function GET(_req: Request, { params }: RouteContext<"/api/media/story/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return new Response("Not found", { status: 404 });
  const res = await pictureResponse(await publicPhotoKey(id.data), 600);
  if (res.ok) res.headers.set("cache-control", "public, max-age=600");
  return res;
}
