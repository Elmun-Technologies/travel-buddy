import { authedJson, json } from "@/lib/api";
import { destroySession } from "@/lib/session";
import { deleteUser } from "@/modules/users/service";

// "Akkauntni o'chirish": foydalanuvchi o'zi o'chira oladi.
// Yumshoq o'chirish (status="deleted"), worker 30 kundan keyin to'liq o'chiradi.
export async function POST(req: Request) {
  const r = await authedJson(req);
  if (!r.ok) return r.res;
  await deleteUser(r.value.user.id);
  await destroySession();
  return json({ ok: true });
}