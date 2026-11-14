import { authedJson, json } from "@/lib/api";
import { fieldErrors } from "@/lib/form";
import { profileSchema } from "@/modules/profiles/schema";
import { saveProfile } from "@/modules/profiles/service";

// Profile save (onboarding + edit). A plain route, not a Server Action: it keeps working
// for pages opened before a deploy (Telegram keeps Mini App pages open for a long time).
export async function POST(req: Request) {
  const r = await authedJson(req);
  if (!r.ok) return r.res;
  const parsed = profileSchema.safeParse(r.value.body);
  if (!parsed.success) return json({ errors: fieldErrors(parsed.error) }, 422);
  await saveProfile(r.value.user.id, parsed.data);
  return json({ ok: true });
}
