import { authedForm, json } from "@/lib/api";
import { DOCUMENT, ImageError, processImage } from "@/lib/images";
import { rateLimit } from "@/lib/rate-limit";
import { deleteFile, newKey, putFile, storageEnabled } from "@/lib/storage";
import { addAgencyDocs, agencyOf, MAX_AGENCY_DOCS } from "@/modules/agencies/service";

// Papers for the agency check (licence, registration): up to 6 pictures, private, read by admins only.
export async function POST(req: Request) {
  if (!storageEnabled()) return json({ error: "uploads_off" }, 503);
  const r = await authedForm(req, 30 * 1024 * 1024);
  if (!r.ok) return r.res;
  const { user, form } = r.value;
  const mine = await agencyOf(user.id);
  if (!mine || mine.role !== "owner") return json({ error: "forbidden" }, 403);
  if (!(await rateLimit(`agencydocs:user:${user.id}`, 10, 86_400)))
    return json({ error: "rate_limited" }, 429);
  const files = form
    .getAll("file")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, MAX_AGENCY_DOCS);
  if (!files.length) return json({ error: "invalid" }, 422);
  const keys: string[] = [];
  try {
    for (const f of files) {
      const img = await processImage(Buffer.from(await f.arrayBuffer()), DOCUMENT);
      const key = newKey("id");
      await putFile(key, img, "image/webp");
      keys.push(key);
    }
  } catch (e) {
    await Promise.all(keys.map((k) => deleteFile(k)));
    const code = e instanceof ImageError ? e.code : "unreadable";
    return json({ error: code }, code === "too_big" ? 413 : 422);
  }
  if (!(await addAgencyDocs(mine.agency.id, keys))) {
    await Promise.all(keys.map((k) => deleteFile(k)));
    return json({ error: "limit" }, 409);
  }
  return json({ ok: true });
}
