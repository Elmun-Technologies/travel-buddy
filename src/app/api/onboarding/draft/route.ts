import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { saveDraft } from "@/modules/profiles/service";

// Unvalidated work-in-progress (validated on final submit); size-capped and rate-limited.
export async function PUT(req: Request) {
  const r = await authedJson(req, 8_192);
  if (!r.ok) return r.res;
  const { user, body } = r.value;
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid" }, 400);
  if (!(await rateLimit(`draft:user:${user.id}`, 120, 3600))) return json({ error: "rate_limited" }, 429);
  await saveDraft(user.id, body as Record<string, unknown>);
  return json({ ok: true });
}
