import { connection } from "next/server";
import { botUsername } from "@/lib/format";

// Landing CTAs point here: the landing is prerendered at build time, the bot name is runtime env.
export async function GET(req: Request) {
  await connection();
  const bot = botUsername();
  return Response.redirect(bot ? `https://t.me/${bot}` : new URL("/", req.url).toString(), 302);
}
