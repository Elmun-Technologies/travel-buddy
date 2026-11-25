import { z } from "zod";
import { authedForm, json, pictureFrom } from "@/lib/api";
import { ImageError, PHOTO, processImage } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { deleteFile, newKey, putFile, storageEnabled } from "@/lib/storage";
import { track } from "@/lib/track";
import { getRoom, sendImage } from "@/modules/chat/service";

// A photo in the group chat: shrunk to ≤ 1600 px / 500 KB WebP, metadata removed.
export async function POST(req: Request, { params }: RouteContext<"/api/rooms/[tripId]/images">) {
  if (!storageEnabled()) return json({ error: "uploads_off" }, 503);
  const tripId = z.uuid().safeParse((await params).tripId);
  if (!tripId.success) return json({ error: "not_found" }, 404);
  const r = await authedForm(req, 9 * 1024 * 1024);
  if (!r.ok) return r.res;
  const { user, form } = r.value;
  const room = await getRoom(user.id, tripId.data);
  if (!room) return json({ error: "forbidden" }, 403);
  if (!(await rateLimit(`chatimg:user:${user.id}`, 20, 600))) return json({ error: "rate_limited" }, 429);
  const raw = await pictureFrom(form);
  if (!raw) return json({ error: "invalid" }, 422);
  let image: Buffer;
  try {
    image = await processImage(raw, PHOTO);
  } catch (e) {
    const code = e instanceof ImageError ? e.code : "unreadable";
    return json({ error: code }, code === "too_big" ? 413 : 422);
  }
  const key = newKey("chat");
  await putFile(key, image, "image/webp");
  try {
    const id = await sendImage(room.id, user.id, key, "");
    track("message_sent", user.id, { kind: "image" });
    return json({ id });
  } catch (e) {
    await deleteFile(key);
    throw e;
  }
}
