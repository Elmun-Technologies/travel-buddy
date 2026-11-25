import { z } from "zod";
import { authedForm, json, pictureFrom } from "@/lib/api";
import { ImageError, PHOTO, processImage } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { deleteFile, newKey, putFile, storageEnabled } from "@/lib/storage";
import { addPhoto, albumAccess, MAX_PHOTOS_PER_PERSON, photoCount } from "@/modules/memories/service";

// A photo for the trip album (one file per request; the page sends several in turn).
export async function POST(req: Request, { params }: RouteContext<"/api/trips/[id]/photos">) {
  if (!storageEnabled()) return json({ error: "uploads_off" }, 503);
  const tripId = z.uuid().safeParse((await params).id);
  if (!tripId.success) return json({ error: "not_found" }, 404);
  const r = await authedForm(req, 9 * 1024 * 1024);
  if (!r.ok) return r.res;
  const { user, form } = r.value;
  if (!(await albumAccess(user.id, tripId.data))) return json({ error: "forbidden" }, 403);
  if (!(await rateLimit(`photo:user:${user.id}`, 60, 3600))) return json({ error: "rate_limited" }, 429);
  if ((await photoCount(user.id, tripId.data)) >= MAX_PHOTOS_PER_PERSON) return json({ error: "limit" }, 409);
  const raw = await pictureFrom(form);
  if (!raw) return json({ error: "invalid" }, 422);
  const caption =
    typeof form.get("caption") === "string" ? String(form.get("caption")).trim().slice(0, 140) : "";
  let image: Buffer;
  try {
    image = await processImage(raw, PHOTO);
  } catch (e) {
    const code = e instanceof ImageError ? e.code : "unreadable";
    return json({ error: code }, code === "too_big" ? 413 : 422);
  }
  const key = newKey("photos");
  await putFile(key, image, "image/webp");
  try {
    return json({ id: await addPhoto(user.id, tripId.data, key, caption || null) });
  } catch (e) {
    await deleteFile(key);
    throw e;
  }
}
