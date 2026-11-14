import { connection } from "next/server";
import { routing } from "@/i18n/routing";
import { shareImage } from "@/lib/og";
import { tripShare } from "@/lib/trip-share";

// 1080×1920 PNG for Instagram / Telegram stories ("Story uchun rasm").
export async function GET(req: Request, { params }: RouteContext<"/api/trips/[id]/story">) {
  await connection();
  const q = new URL(req.url).searchParams.get("locale");
  const locale = routing.locales.find((l) => l === q) ?? routing.defaultLocale;
  const s = await tripShare((await params).id, locale);
  if (!s) return new Response("Not found", { status: 404 });
  const img = await shareImage(s.card, "story");
  img.headers.set("content-disposition", `inline; filename="trip-${s.trip.publicCode}.png"`);
  img.headers.set("cache-control", "public, max-age=300");
  return img;
}
