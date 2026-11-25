import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { smsEnabled } from "@/lib/sms";
import { setSmsConsent } from "@/modules/users/service";

const body = z.object({ on: z.boolean() });

/** "SMS orqali ham xabar bering": only for people with a verified phone, and only while SMS is switched on. */
export async function PUT(req: Request) {
  const r = await authedJson(req, 128);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  if (!smsEnabled() && b.data.on) return json({ error: "sms_off" }, 503);
  if (!r.value.user.phoneVerified) return json({ error: "phone_required" }, 409);
  await setSmsConsent(r.value.user.id, b.data.on);
  return json({ ok: true });
}
