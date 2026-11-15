import { Suspense } from "react";
import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CheckIcon, Display, Panel } from "@/components/clay";
import { SoundButton } from "@/components/sound";
import { PageLoading } from "@/components/page-loading";
import { Link } from "@/i18n/navigation";
import { type Country, countryName, todayISO, BAND_MAX } from "@/lib/catalog";
import { formatBudget, formatTripDates } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { isSampleTrip } from "@/lib/sample";
import { countryPhoto } from "@/lib/photos";
import { rankTrips, travelerFor } from "@/modules/matching/service";
import { getOwnProfile } from "@/modules/profiles/service";
import { listFeed, listForming, listMyTrips } from "@/modules/trips/service";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function HomePage(props: PageProps<"/[locale]/home">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Home {...props} />
    </Suspense>
  );
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const label = "text-xs font-semibold tracking-[.04em] uppercase";

// App-Home.png. No match % before phase 7: "why it fits" lists only real overlaps with the profile.
async function Home({ params }: PageProps<"/[locale]/home">) {
  const locale = asLocale((await params).locale);
  const { user } = await requireProfile(locale);
  const today = todayISO();
  const profile = (await getOwnProfile(user.id))!;
  const dreams = profile.dreamDestinations as Country[];
  const budget = BAND_MAX[profile.budgetBand ?? ""];

  const [mine, suggested, anyTrips, forming, t, ts, traveler] = await Promise.all([
    listMyTrips(user.id),
    listFeed(user.id, { page: 1, country: dreams.length ? dreams : undefined, budget }),
    listFeed(user.id, { page: 1 }),
    listForming(user.id),
    getTranslations("home"),
    getTranslations("styles"),
    travelerFor(user.id),
  ]);
  const myIds = new Set(mine.map((m) => m.id));
  const next = mine
    .filter((m) => m.myStatus.status === "approved" && m.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  // "Sizga yoqishi mumkin": every open trip we fetched, scored (CLAUDE.md §6), best first.
  const pool = [...suggested.items, ...anyTrips.items].filter(
    (x, i, all) => !myIds.has(x.id) && all.findIndex((y) => y.id === x.id) === i,
  );
  const picks = (
    traveler ? await rankTrips(traveler, pool) : pool.map((trip) => ({ trip, match: null }))
  ).slice(0, 6);

  const hour = Number(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tashkent", hour: "numeric", hour12: false }),
  );
  const greeting = hour < 11 ? t("morning") : hour < 18 ? t("day") : t("evening");

  return (
    <div className="flex flex-col gap-2">
      <Panel className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[13px] text-muted-foreground">{greeting}</div>
          <Display className="mt-0.5 text-[30px]">{profile.displayName}</Display>
        </div>
        <SoundButton className="ml-auto" />
        <Link href="/me" className="flex flex-col items-end gap-1.5">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#c9d4e3] font-semibold">
            {profile.displayName.slice(0, 1)}
          </span>
          {user.phoneVerified && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-success">
              <CheckIcon className="size-3" />
              {t("verified")}
            </span>
          )}
        </Link>
      </Panel>

      {next ? (
        <Link
          href={`/trips/${next.id}`}
          className="press lift flex flex-col gap-3.5 rounded-panel bg-ink p-[18px] text-white"
        >
          <div className="flex items-center justify-between">
            <span className={`${label} text-[#c9c9c9]`}>{t("yourTrip")}</span>
            <span className="rounded-full bg-signal px-2.5 py-1 text-xs font-semibold text-ink">
              {t("daysLeft", { n: daysBetween(today, next.startDate) })}
            </span>
          </div>
          <Display as="div" className="text-[26px]">
            {next.title}
          </Display>
          <div className="flex gap-4 text-[13px] text-[#d6d6d6]">
            <span>{formatTripDates(next, locale)}</span>
            {next.groupSizeMax && (
              <span>{t("members", { n: next.approvedCount, max: next.groupSizeMax })}</span>
            )}
          </div>
        </Link>
      ) : (
        <Link
          href="/trips/new"
          className="press flex items-center justify-between gap-3 rounded-panel bg-ink p-[18px] text-white"
        >
          <div>
            <span className={`${label} text-[#c9c9c9]`}>{t("yourTrip")}</span>
            <Display as="div" className="mt-2 text-[22px]">
              {t("noTripYet")}
            </Display>
          </div>
          <span className="flex size-12 flex-none items-center justify-center rounded-full bg-signal text-ink">
            <Plus className="size-5" aria-hidden="true" />
          </span>
        </Link>
      )}

      {picks.length > 0 && (
        <section className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1 pt-2">
            <Display as="h2" className="text-2xl">
              {t("forYou")}
            </Display>
            <Link href="/trips" className="min-h-11 py-3 text-sm underline underline-offset-4">
              {t("all")}
            </Link>
          </div>
          <div className="-mx-3 flex snap-x gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
            {picks.map(({ trip, match }) => {
              const shared = trip.travelStyles.find((s) => profile.travelStyles.includes(s));
              const why = (match?.reasons ?? [])
                .slice(0, 3)
                .map((f) => (f === "styles" && shared ? ts(shared).toLowerCase() : t(`why_${f}`)));
              return (
                <Link
                  key={trip.id}
                  href={`/trips/${trip.id}`}
                  className="press flex w-[300px] flex-none snap-start flex-col overflow-hidden rounded-[22px] bg-card"
                >
                  <div className="relative h-[150px] bg-[#b9c7d6]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP */}
                    <img
                      src={countryPhoto(trip.destinationCountry, 1200, trip.destinationCity)}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                    {match?.percent != null && (
                      <span className="pop-in absolute top-3 left-3 rounded-full bg-blue px-3 py-1.5 text-sm font-semibold text-white">
                        {t("matchPercent", { n: match.percent })}
                      </span>
                    )}
                    {isSampleTrip(trip.id) && (
                      <span className="absolute top-3 right-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold">
                        {t("sample")}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 p-3.5">
                    <Display as="div" className="text-xl">
                      {trip.title}
                    </Display>
                    <div className="text-[13px] text-muted-foreground">
                      {countryName(trip.destinationCountry, locale)} · {formatTripDates(trip, locale)}
                      {trip.budgetMin != null &&
                        ` · ${formatBudget(trip.budgetMin, trip.budgetMax, trip.currency)}`}
                    </div>
                    {why.length > 0 && (
                      <div className="rounded-[10px] bg-blue-soft p-2 text-xs text-blue-ink">
                        {capitalize(
                          why.length === 1
                            ? t("whyOne", { last: why[0] })
                            : t("whyMany", { first: why.slice(0, -1).join(", "), last: why.at(-1)! }),
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {forming.length > 0 && (
        <Panel className="flex flex-col gap-3.5">
          <Display as="h2" className="text-2xl">
            {t("forming")}
          </Display>
          {forming.map((g) => (
            <Link key={g.id} href={`/trips/${g.id}`} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <strong>{g.title}</strong>
                <span>
                  {g.approvedCount}/{g.groupSizeMax}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-background">
                <div
                  className="grow-x h-full rounded-full bg-ink"
                  style={{ width: `${Math.round(g.fill * 100)}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                {formatTripDates(g, locale)} · {t("spotsLeft", { n: g.groupSizeMax! - g.approvedCount })}
              </div>
            </Link>
          ))}
        </Panel>
      )}

      <Link
        href="/visa"
        className="press flex min-h-16 items-center justify-between rounded-panel bg-card px-4"
      >
        <span className="flex flex-col">
          <span className="text-[17px] font-semibold">{t("visaTitle")}</span>
          <span className="text-sm text-muted-foreground">{t("visaText")}</span>
        </span>
        <span aria-hidden="true">{"↗"}</span>
      </Link>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/clubs"
          className="press flex min-h-[130px] flex-col justify-between rounded-panel bg-blue p-4 text-white"
        >
          <span className={label}>{t("clubs")}</span>
          <Display as="span" className="text-xl">
            {t("clubsText")}
          </Display>
        </Link>
        <Link
          href="/memories"
          className="press flex min-h-[130px] flex-col justify-between rounded-panel bg-signal p-4 text-ink"
        >
          <span className={label}>{t("memories")}</span>
          <Display as="span" className="text-xl">
            {t("memoriesText")}
          </Display>
        </Link>
      </div>

      <Link
        href="/trips/new"
        className="press fixed right-4 bottom-24 z-20 flex min-h-[52px] items-center gap-2 rounded-full bg-ink px-5 font-semibold text-white shadow-lg md:bottom-8"
      >
        <Plus className="size-5" aria-hidden="true" />
        {t("newTrip")}
      </Link>
    </div>
  );
}
