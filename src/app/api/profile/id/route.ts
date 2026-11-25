import { authedForm, json, pictureFrom } from "@/lib/api";
import { DOCUMENT, ImageError, processImage } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { deleteFile, newKey, putFile, storageEnabled } from "@/lib/storage";
import { submitId } from "@/modules/verification/service";

// "ID tasdiqlash": a photo of the document and a selfie, checked by a person on our team (no paid service).
// Files are private (served only to admins) and erased 30 days after the decision.
export async function POST(req: Request) {
  if (!storageEnabled()) return json({ error: "uploads_off" }, 503);
  const r = await authedForm(req, 18 * 1024 * 1024);
  if (!r.ok) return r.res;
  const { user, form } = r.value;
  if (!(await rateLimit(`idverify:user:${user.id}`, 5, 86_400))) return json({ error: "rate_limited" }, 429);
  const [doc, selfie] = await Promise.all([pictureFrom(form, "document"), pictureFrom(form, "selfie")]);
  if (!doc || !selfie) return json({ error: "invalid" }, 422);
  let docImg: Buffer;
  let selfieImg: Buffer;
  try {
    [docImg, selfieImg] = await Promise.all([processImage(doc, DOCUMENT), processImage(selfie, DOCUMENT)]);
  } catch (e) {
    const code = e instanceof ImageError ? e.code : "unreadable";
    return json({ error: code }, code === "too_big" ? 413 : 422);
  }
  const [docKey, selfieKey] = [newKey("id"), newKey("id")];
  await Promise.all([putFile(docKey, docImg, "image/webp"), putFile(selfieKey, selfieImg, "image/webp")]);
  const res = await submitId(user.id, docKey, selfieKey);
  await Promise.all(res.stale.map((k) => deleteFile(k)));
  return res.ok ? json({ ok: true }) : json({ error: "already_verified" }, 409);
}
