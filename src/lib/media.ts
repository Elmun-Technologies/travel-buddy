import "server-only";
import { getFile } from "./storage";

/** Serve a stored picture. Always `private`: only the signed-in person who was allowed to ask gets it. */
export async function pictureResponse(key: string | null | undefined, maxAge = 86_400) {
  if (!key) return new Response("Not found", { status: 404 });
  const f = await getFile(key);
  if (!f) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(f.body), {
    headers: {
      "content-type": f.contentType.startsWith("image/") ? f.contentType : "application/octet-stream",
      "cache-control": `private, max-age=${maxAge}`,
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
