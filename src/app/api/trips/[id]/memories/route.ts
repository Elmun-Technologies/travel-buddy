import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { deleteFile } from "@/lib/storage";
import { albumAccess, removePhoto, saveStory, setConsent } from "@/modules/memories/service";

const body = z.discriminatedUnion("op", [
  z.object({ op: z.literal("story"), body: z.string().trim().min(2).max(600) }),
  z.object({ op: z.literal("photo.delete"), id: z.uuid() }),
  z.object({ op: z.literal("consent"), on: z.boolean() }),
]);

// Stories and photo removal for the album.
export async function POST(req: Request, { params }: RouteContext<"/api/trips/[id]/memories">) {
  const tripId = z.uuid().safeParse((await params).id);
  if (!tripId.success) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 2_048);
  if (!r.ok) return r.res;
  const { user } = r.value;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!(await albumAccess(user.id, tripId.data))) return json({ error: "forbidden" }, 403);
  if (!(await rateLimit(`memories:user:${user.id}`, 60, 3600))) return json({ error: "rate_limited" }, 429);
  if (b.data.op === "story") {
    await saveStory(user.id, tripId.data, b.data.body);
    return json({ ok: true });
  }
  if (b.data.op === "consent")
    return (await setConsent(user.id, tripId.data, b.data.on))
      ? json({ ok: true })
      : json({ error: "forbidden" }, 403);
  const key = await removePhoto(user.id, tripId.data, b.data.id);
  if (!key) return json({ error: "forbidden" }, 403);
  await deleteFile(key);
  return json({ ok: true });
}
