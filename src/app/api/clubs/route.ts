import { z } from "zod";
import { authedJson, json } from "@/lib/api";
import { fieldErrors } from "@/lib/form";
import { rateLimit } from "@/lib/rate-limit";
import { createClub } from "@/modules/clubs/service";

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);
const body = z.object({
  name: z.string().trim().min(3).max(60),
  description: text(600),
  rules: text(600),
  city: text(60),
  privacy: z.enum(["open", "closed"]).default("open"),
});

// "Klub ochamiz".
export async function POST(req: Request) {
  const r = await authedJson(req, 4_096);
  if (!r.ok) return r.res;
  const b = body.safeParse(r.value.body);
  if (!b.success) return json({ errors: fieldErrors(b.error) }, 422);
  if (!(await rateLimit(`club:user:${r.value.user.id}`, 5, 86_400)))
    return json({ error: "rate_limited" }, 429);
  const res = await createClub(r.value.user.id, b.data);
  return res.ok ? json({ id: res.id }) : json({ error: res.error }, 409);
}
