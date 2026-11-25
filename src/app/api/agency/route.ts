import { authedJson, json } from "@/lib/api";
import { fieldErrors } from "@/lib/form";
import { rateLimit } from "@/lib/rate-limit";
import { agencyOp } from "@/modules/agencies/schema";
import { closeOffer, createOffer, decideLead, registerAgency, updateOffer } from "@/modules/agencies/service";

// Agency cabinet: registration, tours and requests, one JSON route.
export async function POST(req: Request) {
  const r = await authedJson(req, 16_384);
  if (!r.ok) return r.res;
  const { user } = r.value;
  const b = agencyOp.safeParse(r.value.body);
  if (!b.success) return json({ errors: fieldErrors(b.error) }, 422);
  if (!(await rateLimit(`agency:user:${user.id}`, 200, 3600))) return json({ error: "rate_limited" }, 429);
  const op = b.data;
  switch (op.op) {
    case "register": {
      if (!(await rateLimit(`agencyreg:user:${user.id}`, 3, 86_400)))
        return json({ error: "rate_limited" }, 429);
      const res = await registerAgency(user.id, op.agency);
      return res.ok ? json({ id: res.id }) : json({ error: res.error }, 409);
    }
    case "offer.create":
    case "offer.update": {
      const res =
        op.op === "offer.create"
          ? await createOffer(user.id, op.offer)
          : await updateOffer(user.id, op.tripId, op.offer);
      return res.ok
        ? json({ id: res.id })
        : json({ error: res.error }, res.error === "not_found" ? 404 : 409);
    }
    case "offer.close":
    case "offer.open":
      return (await closeOffer(user.id, op.tripId, op.op === "offer.close"))
        ? json({ ok: true })
        : json({ error: "not_found" }, 404);
    case "lead": {
      const res = await decideLead(user.id, op.leadId, op.action);
      return res.ok
        ? json({ ok: true })
        : json({ error: res.error }, res.error === "forbidden" ? 403 : res.error === "not_found" ? 404 : 409);
    }
  }
}
