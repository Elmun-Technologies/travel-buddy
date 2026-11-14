import { notFound } from "next/navigation";
import { shareImage } from "@/lib/og";
import { tripShare } from "@/lib/trip-share";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Trip";

// OG picture for Telegram / Instagram link previews.
export default async function Image({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const s = await tripShare(id, locale);
  if (!s) notFound();
  return shareImage(s.card, "og");
}
