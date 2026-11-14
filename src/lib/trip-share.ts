import "server-only";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { botUsername, formatBudget, formatTripDates } from "./format";
import type { ShareCard } from "./og";
import { getTripView } from "@/modules/trips/service";

/** Public share data for a trip (or null if it isn't public). */
export async function tripShare(id: string, locale: string) {
  const ok = z.uuid().safeParse(id);
  const trip = ok.success ? await getTripView(ok.data, null) : null;
  if (!trip || !trip.publicCode) return null;
  const t = await getTranslations({ locale, namespace: "share" });
  const budget = formatBudget(trip.budgetMin, trip.budgetMax, trip.currency);
  const spots = trip.groupSizeMax ? t("spots", { n: trip.approvedCount, max: trip.groupSizeMax }) : null;
  const card: ShareCard = {
    title: trip.title,
    meta: [formatTripDates(trip, locale), budget, spots].filter(Boolean).join(" · "),
    cta: t("cta"),
    country: trip.destinationCountry,
    city: trip.destinationCity,
  };
  return { trip, card, ...shareLinks(trip.publicCode, locale) };
}

/** Inside Telegram the t.me link opens the Mini App on the trip; elsewhere the web page. */
export function shareLinks(code: string, locale: string) {
  const bot = botUsername();
  return {
    tgLink: bot ? `https://t.me/${bot}?startapp=trip_${code}` : null,
    webLink: `${process.env.APP_URL ?? ""}/${locale}/t/${code}`,
  };
}
