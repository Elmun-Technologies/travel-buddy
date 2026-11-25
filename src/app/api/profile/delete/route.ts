import { authedJson, json } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { destroySession } from "@/lib/session";
import { track } from "@/lib/track";
import { deleteAccount } from "@/modules/account/service";

// "Akkauntni o'chirish": hidden and signed out at once, erased for good after 30 days (worker).
export async function POST(req: Request) {
  const r = await authedJson(req, 64);
  if (!r.ok) return r.res;
  if (!(await rateLimit(`delete:user:${r.value.user.id}`, 5, 86_400)))
    return json({ error: "rate_limited" }, 429);
  await deleteAccount(r.value.user.id);
  track("account_deleted", r.value.user.id);
  await destroySession();
  return json({ ok: true });
}
