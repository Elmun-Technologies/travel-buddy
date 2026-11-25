import { authedForm, authedJson, json, pictureFrom } from "@/lib/api";
import { AVATAR, ImageError, processImage } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { deleteFile, newKey, putFile, storageEnabled } from "@/lib/storage";
import { replaceAvatar } from "@/modules/profiles/service";

// Profile picture: any JPEG/PNG/WebP up to 8 MB in, a square WebP ≤ 1080 px and ≤ 300 KB out.
export async function POST(req: Request) {
  if (!storageEnabled()) return json({ error: "uploads_off" }, 503);
  const r = await authedForm(req, 9 * 1024 * 1024);
  if (!r.ok) return r.res;
  const { user, form } = r.value;
  if (!(await rateLimit(`avatar:user:${user.id}`, 10, 3600))) return json({ error: "rate_limited" }, 429);
  const raw = await pictureFrom(form);
  if (!raw) return json({ error: "invalid" }, 422);
  let image: Buffer;
  try {
    image = await processImage(raw, AVATAR, true);
  } catch (e) {
    return json(
      { error: e instanceof ImageError ? e.code : "unreadable" },
      e instanceof ImageError && e.code === "too_big" ? 413 : 422,
    );
  }
  const key = newKey("avatars");
  await putFile(key, image, "image/webp");
  const res = await replaceAvatar(user.id, key);
  if (!res.ok) {
    await deleteFile(key);
    return json({ error: "profile_required" }, 409);
  }
  await deleteFile(res.old);
  return json({ ok: true, v: key.slice(8, 16) });
}

export async function DELETE(req: Request) {
  const r = await authedJson(req, 64);
  if (!r.ok) return r.res;
  const res = await replaceAvatar(r.value.user.id, null);
  await deleteFile(res.old);
  return json({ ok: true });
}
