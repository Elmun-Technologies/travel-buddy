import { z } from "zod";
import { pictureResponse } from "@/lib/media";
import { getSessionUser } from "@/lib/session";
import { idFileKey } from "@/modules/verification/service";

// Pictures of an ID check: administrators only, never cached.
export async function GET(_req: Request, { params }: RouteContext<"/api/admin/id/[id]/[kind]">) {
  const p = await params;
  const id = z.uuid().safeParse(p.id);
  const kind = z.enum(["doc", "selfie"]).safeParse(p.kind);
  const user = await getSessionUser();
  if (!id.success || !kind.success || user?.role !== "admin")
    return new Response("Not found", { status: 404 });
  const res = await pictureResponse(await idFileKey(id.data, kind.data), 0);
  res.headers.set("cache-control", "no-store");
  return res;
}
