import { getLocale, getTranslations } from "next-intl/server";
import { ArrowIcon } from "@/components/clay";
import { LinkPending } from "@/components/link-pending";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/catalog";
import { formatBudget, formatTripDates } from "@/lib/format";
import { isSampleTrip } from "@/lib/sample";
import { countryPhoto } from "@/lib/photos";
import type { TripCard as Trip } from "@/modules/trips/service";

const tag =
  "inline-flex items-center rounded-full border border-input bg-card px-2.5 py-1 text-xs font-medium";
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

/** Feed card (App-Trips.png): destination photo, title, dates · budget, fill bar, tags. */
export async function TripCard({ trip, badge, href }: { trip: Trip; badge?: string; href?: string }) {
  const [t, ts, locale] = await Promise.all([
    getTranslations("trip"),
    getTranslations("styles"),
    getLocale(),
  ]);
  const budget = formatBudget(trip.budgetMin, trip.budgetMax, trip.currency);
  const fill = trip.groupSizeMax
    ? Math.min(100, Math.round((trip.approvedCount / trip.groupSizeMax) * 100))
    : 0;
  return (
    <Link
      href={href ?? `/trips/${trip.id}`}
      className="press relative flex flex-col overflow-hidden rounded-[22px] bg-card"
    >
      <LinkPending />
      <div className="relative h-[132px] bg-[#b9c7d6]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP */}
        <img
          src={countryPhoto(trip.destinationCountry, 1200, trip.destinationCity)}
          alt={countryName(trip.destinationCountry, locale)}
          loading="lazy"
          draggable={false}
          className="pointer-events-none size-full object-cover select-none"
        />
        <div className="absolute top-3 left-3 flex gap-1.5">
          {isSampleTrip(trip.id) && (
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink">
              {t("sample")}
            </span>
          )}
          {badge && (
            <span className="rounded-full bg-blue px-2.5 py-1 text-xs font-semibold text-white">{badge}</span>
          )}
        </div>
        <span className="absolute right-3 bottom-3 flex size-11 items-center justify-center rounded-full bg-signal text-ink">
          <ArrowIcon />
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-3.5 pb-4">
        <div className="font-display text-[22px]">{trip.title}</div>
        <div className="text-[13px] text-muted-foreground">
          {t("cardMeta", {
            country: countryName(trip.destinationCountry, locale),
            days: days(trip.startDate, trip.endDate),
          })}{" "}
          · {formatTripDates(trip, locale)}
          {budget && ` · ${budget}`}
        </div>
        {trip.groupSizeMax && (
          <div className="flex items-center gap-2.5">
            <div className="h-1.5 flex-1 rounded-full bg-background">
              <div className="h-full rounded-full bg-ink" style={{ width: `${fill}%` }} />
            </div>
            <span className="text-[13px] font-semibold">
              {trip.approvedCount}/{trip.groupSizeMax}
            </span>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {trip.womenOnly && (
            <span className={`${tag} border-ink bg-ink text-white`}>{t("womenOnlyBadge")}</span>
          )}
          {trip.status === "full" && <span className={tag}>{t("status.full")}</span>}
          {trip.kind === "agency" && <span className={tag}>{t("agency")}</span>}
          {trip.travelStyles.slice(0, 2).map((s) => (
            <span key={s} className={tag}>
              {ts(s)}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
