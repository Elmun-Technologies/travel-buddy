import { z } from "zod";
import { pictureResponse } from "@/lib/media";
import { getSessionUser } from "@/lib/session";
import { agencyDocKey } from "@/modules/agencies/service";

// Agency papers: administrators only, never cached.
export async function GET(_req: Request, { params }: RouteContext<"/api/admin/agency-doc/[id]/[index]">) {
  const p = await params;
  const id = z.uuid().safeParse(p.id);
  const index = z.coerce.number().int().min(0).max(20).safeParse(p.index);
  const user = await getSessionUser();
  if (!id.success || !index.success || user?.role !== "admin")
    return new Response("Not found", { status: 404 });
  const res = await pictureResponse(await agencyDocKey(id.data, index.data), 0);
  res.headers.set("cache-control", "no-store");
  return res;
}
