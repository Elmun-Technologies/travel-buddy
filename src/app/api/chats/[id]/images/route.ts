import { z } from "zod";
import { authedForm, json, pictureFrom } from "@/lib/api";
import { ImageError, PHOTO, processImage } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { deleteFile, newKey, putFile, storageEnabled } from "@/lib/storage";
import { getChat, notifyDirect, sendImage } from "@/modules/chat/service";

export async function POST(req: Request, { params }: RouteContext<"/api/chats/[id]/images">) {
  if (!storageEnabled()) return json({ error: "uploads_off" }, 503);
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return json({ error: "not_found" }, 404);
  const r = await authedForm(req, 9 * 1024 * 1024);
  if (!r.ok) return r.res;
  const { user, form } = r.value;
  const chat = await getChat(user.id, id.data);
  if (!chat) return json({ error: "forbidden" }, 403);
  if (!chat.canWrite) return json({ error: "blocked" }, 403);
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
    const msgId = await sendImage(id.data, user.id, key, "");
    await notifyDirect(id.data, user.id);
    return json({ id: msgId });
  } catch (e) {
    await deleteFile(key);
    throw e;
  }
}
