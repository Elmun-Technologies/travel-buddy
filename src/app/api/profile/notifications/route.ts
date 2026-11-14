import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { NOTIFY_KINDS } from "@/modules/notifications/service";
import { setNotifyOff } from "@/modules/users/service";

const body = z.object({ off: z.array(z.enum(NOTIFY_KINDS)).max(NOTIFY_KINDS.length) });

/** Which bot notifications the user turned off (profile → Bildirishnomalar). */
export async function PUT(req: Request) {
  const r = await authedJson(req, 1_024);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  await setNotifyOff(r.value.user.id, [...new Set(b.data.off)]);
  return json({ ok: true });
}
