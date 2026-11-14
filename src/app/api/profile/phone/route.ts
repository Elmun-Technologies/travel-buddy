import { connection } from "next/server";
import { json } from "@/lib/api";
import { getSessionUser } from "@/lib/session";

// Onboarding step 4 polls this after the user shares the number with the bot.
export async function GET() {
  await connection();
  const user = await getSessionUser();
  if (!user) return json({ error: "unauthorized" }, 401);
  return json({ verified: user.phoneVerified });
}
