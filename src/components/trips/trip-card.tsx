import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/catalog";
import { flag, formatBudget, formatDateRange } from "@/lib/format";
import type { TripCard as Trip } from "@/modules/trips/service";

export async function TripCard({ trip, badge }: { trip: Trip; badge?: string }) {
  const [t, ts, locale] = await Promise.all([
    getTranslations("trip"),
    getTranslations("styles"),
    getLocale(),
  ]);
  const budget = formatBudget(trip.budgetMin, trip.budgetMax, trip.currency, locale);
  return (
    <Link
      href={`/trips/${trip.id}`}
      className="flex flex-col gap-3 rounded-2xl border bg-background p-5 transition-colors hover:border-primary/50"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {flag(trip.destinationCountry)} {countryName(trip.destinationCountry, locale)}
            {trip.destinationCity && `, ${trip.destinationCity}`}
          </p>
          <h3 className="mt-1 text-lg font-semibold">{trip.title}</h3>
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm">
        {formatDateRange(trip.startDate, trip.endDate, locale)}
        {budget && <span className="text-muted-foreground"> · {budget}</span>}
      </p>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {trip.groupSizeMax && (
          <span className="rounded-full bg-muted px-2.5 py-1">
            {t("spots", { n: trip.approvedCount, max: trip.groupSizeMax })}
          </span>
        )}
        {trip.status === "full" && (
          <span className="rounded-full bg-muted px-2.5 py-1">{t("status.full")}</span>
        )}
        {trip.womenOnly && (
          <span className="rounded-full bg-pink-100 px-2.5 py-1 text-pink-800">{t("womenOnlyBadge")}</span>
        )}
        {trip.kind === "agency" && <span className="rounded-full bg-muted px-2.5 py-1">{t("agency")}</span>}
        {trip.travelStyles.slice(0, 3).map((s) => (
          <span key={s} className="rounded-full border px-2.5 py-1">
            {ts(s)}
          </span>
        ))}
      </div>
      {trip.ownerName && (
        <p className="text-sm text-muted-foreground">
          {t("organizer")}: {trip.ownerName}
        </p>
      )}
    </Link>
  );
}
