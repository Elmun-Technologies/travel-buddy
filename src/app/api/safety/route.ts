import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import {
  addContact,
  createFamilyLink,
  isApprovedMember,
  recordSafety,
  removeContact,
  revokeFamilyLink,
} from "@/modules/safety/service";

const point = { lat: z.number().min(-90).max(90).optional(), lng: z.number().min(-180).max(180).optional() };
const body = z.discriminatedUnion("op", [
  z.object({ op: z.enum(["sos", "checkin", "location", "location_off"]), tripId: z.uuid(), ...point }),
  z.object({ op: z.enum(["family.create", "family.revoke"]), tripId: z.uuid() }),
  z.object({ op: z.literal("contact.add"), name: z.string().trim().min(1).max(40) }),
  z.object({ op: z.literal("contact.remove"), id: z.uuid() }),
]);

/** SOS, "Hammasi joyida", location share, family link and trusted contacts. */
export async function POST(req: Request) {
  const r = await authedJson(req, 1_024);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ error: "invalid" }, 422);
  const userId = r.value.user.id;
  const op = b.data;
  // A real SOS must always get through, so its limit is generous; it only stops scripted floods
  // (every SOS notifies the whole group and the trusted contacts).
  const limited =
    op.op === "sos"
      ? !(await rateLimit(`sos:user:${userId}`, 5, 600))
      : !(await rateLimit(`safety:user:${userId}`, 60, 600));
  if (limited) return json({ error: "rate_limited" }, 429);

  if (op.op === "contact.add") {
    const c = await addContact(userId, op.name);
    return c ? json(c) : json({ error: "too_many" }, 409);
  }
  if (op.op === "contact.remove") {
    await removeContact(userId, op.id);
    return json({ ok: true });
  }
  if (!(await isApprovedMember(userId, op.tripId))) return json({ error: "forbidden" }, 403);
  if (op.op === "family.create") return json({ token: await createFamilyLink(userId, op.tripId) });
  if (op.op === "family.revoke") {
    await revokeFamilyLink(userId, op.tripId);
    return json({ ok: true });
  }
  const { lat, lng } = op as { lat?: number; lng?: number };
  const at = lat != null && lng != null ? { lat, lng } : null;
  if (op.op === "location" && !at) return json({ error: "invalid" }, 422);
  await recordSafety(userId, op.tripId, op.op as "sos" | "checkin" | "location" | "location_off", at);
  return json({ ok: true });
}
