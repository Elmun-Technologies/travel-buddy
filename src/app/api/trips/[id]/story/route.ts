import { connection } from "next/server";
import { routing } from "@/i18n/routing";
import { clientIp } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { shareImage } from "@/lib/og";
import { tripShare } from "@/lib/trip-share";

// 1080×1920 PNG for Instagram / Telegram stories ("Story uchun rasm"); ?kind=og → 1200×630 link preview.
export async function GET(req: Request, { params }: RouteContext<"/api/trips/[id]/story">) {
  await connection();
  // Rendering a PNG is the most expensive thing we do without logging in: cap it per address.
  if (!(await rateLimit(`story:ip:${clientIp(req.headers)}`, 60, 60)))
    return new Response("Too many requests", { status: 429 });
  const params_ = new URL(req.url).searchParams;
  const kind = params_.get("kind") === "og" ? "og" : "story";
  const q = params_.get("locale");
  const locale = routing.locales.find((l) => l === q) ?? routing.defaultLocale;
  const s = await tripShare((await params).id, locale);
  if (!s) return new Response("Not found", { status: 404 });
  const img = await shareImage(s.card, kind);
  img.headers.set("content-disposition", `inline; filename="trip-${s.trip.publicCode}.png"`);
  img.headers.set("cache-control", "public, max-age=600, s-maxage=600");
  return img;
}
