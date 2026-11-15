import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { adminOp } from "@/modules/admin/schema";
import { applyAdminOp } from "@/modules/admin/service";

/** All admin changes: admins only, Zod-checked, rate-limited, audited (audit_logs). */
export async function POST(req: Request) {
  const r = await authedJson(req, 16_384);
  if (!r.ok) return r.res;
  const user = r.value.user;
  if (user.role !== "admin") return json({ error: "not_found" }, 404);
  const op = adminOp.safeParse(r.value.body);
  if (!op.success)
    return json({ error: "invalid", issues: op.error.issues.map((i) => i.path.join(".")) }, 422);
  if (!(await rateLimit(`admin:user:${user.id}`, 300, 600))) return json({ error: "rate_limited" }, 429);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ok = await applyAdminOp(user.id, op.data, ip);
  return ok ? json({ ok: true }) : json({ error: "not_found" }, 404);
}
