import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { COUNTRIES } from "@/lib/catalog";
import { setDreamDestination } from "@/modules/profiles/service";

const body = z.object({ country: z.enum(COUNTRIES), on: z.boolean() });

/** Destination page "Saqlash". */
export async function PUT(req: Request) {
  const r = await authedJson(req, 256);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  const ok = await setDreamDestination(r.value.user.id, b.data.country, b.data.on);
  return ok ? json({ ok: true }) : json({ error: "profile_required" }, 409);
}
