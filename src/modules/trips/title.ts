import "server-only";
import { getTranslations } from "next-intl/server";
import { countryName } from "@/lib/catalog";
import { formatTripDates } from "@/lib/format";

const DAY = 86_400_000;

/** "Tbilisi · 6 kun" or "Gruziya · dekabr": the same title for created and edited trips. */
export async function buildTripTitle(
  locale: string,
  country: string,
  city: string | null | undefined,
  dates: { startDate: string; endDate: string; datePrecision: "exact" | "month" },
) {
  const t = await getTranslations({ locale, namespace: "create" });
  const place = city || countryName(country, locale);
  const days = Math.round((Date.parse(dates.endDate) - Date.parse(dates.startDate)) / DAY) + 1;
  return dates.datePrecision === "month"
    ? t("titleMonth", { place, month: formatTripDates(dates, locale) })
    : t("titleDays", { place, n: days });
}
