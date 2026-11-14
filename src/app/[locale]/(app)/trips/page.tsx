import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { FeedChips, type FeedQuery } from "@/components/trips/feed-chips";
import { TripCard } from "@/components/trips/trip-card";
import { Link } from "@/i18n/navigation";
import { type Country, countryName, POPULAR_DESTINATIONS, todayISO, TRAVEL_STYLES } from "@/lib/catalog";
import { asLocale } from "@/lib/guard";
import { countryPhoto, FEATURED_COUNTRIES } from "@/lib/photos";
import { getSessionUser } from "@/lib/session";
import { getOwnProfile } from "@/modules/profiles/service";
import { feedFilterSchema } from "@/modules/trips/schema";
import { listFeed } from "@/modules/trips/service";

export default function FeedPage(props: PageProps<"/[locale]/trips">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Feed {...props} />
    </Suspense>
  );
}

const BAND_MAX: Record<string, number> = { lt300: 300, "300_600": 600, "600_1000": 1000 };

function monthOpt(offset: number, locale: string) {
  const [y, m] = todayISO().split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return {
    value: d.toISOString().slice(0, 7),
    label: new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(d),
  };
}

// Public: anyone can browse; blocked owners are hidden for logged-in viewers.
// With no filter in the URL, a signed-in traveller sees trips matching their onboarding answers.
async function Feed({ params, searchParams }: PageProps<"/[locale]/trips">) {
  const locale = asLocale((await params).locale);
  const filter = feedFilterSchema.parse(await searchParams);
  const user = await getSessionUser();
  const explicit = !!(
    filter.all ||
    filter.country ||
    filter.month ||
    filter.date ||
    filter.budget ||
    filter.style
  );
  const profile = user && !explicit ? await getOwnProfile(user.id) : null;
  const auto = !!profile && !!(profile.dreamDestinations.length || BAND_MAX[profile.budgetBand ?? ""]);
  const f = auto
    ? {
        ...filter,
        country: profile!.dreamDestinations.length ? (profile!.dreamDestinations as Country[]) : undefined,
        budget: BAND_MAX[profile!.budgetBand ?? ""],
      }
    : filter;

  const [{ items, hasMore, total }, t, ts] = await Promise.all([
    listFeed(user?.id ?? null, f),
    getTranslations("feed"),
    getTranslations("styles"),
  ]);

  const q: FeedQuery = { country: f.country, month: f.month, date: f.date, budget: f.budget, style: f.style };
  const one = f.country?.length === 1 ? countryName(f.country[0], locale) : null;
  const page = (n: number) => {
    const p = new URLSearchParams({ all: "1", page: String(n) });
    for (const [k, v] of Object.entries(q)) if (v && (!Array.isArray(v) || v.length)) p.set(k, String(v));
    return `/trips?${p}`;
  };

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-2">
      <Panel className="flex flex-col gap-3.5">
        <Display className="text-[32px]">{t("title")}</Display>
        <FeedChips
          q={q}
          countries={POPULAR_DESTINATIONS.map((c) => ({ value: c, label: countryName(c, locale) }))}
          styles={TRAVEL_STYLES.map((s) => ({ value: s, label: ts(s) }))}
          months={{ thisMonth: monthOpt(0, locale), nextMonth: monthOpt(1, locale) }}
        />
        {auto && (
          <p className="text-xs text-muted-foreground">
            {t("fromProfile")}{" "}
            <Link href="/trips?all=1" className="font-medium text-blue">
              {t("showAll")}
            </Link>
          </p>
        )}
      </Panel>

      <h2 id="results" className="scroll-mt-4 px-1 pt-2 text-[15px] font-semibold">
        {one ? t("foundIn", { country: one, n: total }) : t("found", { n: total })}
      </h2>

      {items.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <>
          <Panel tone="dark" className="flex flex-col gap-4">
            <Display as="h3" className="text-[26px]">
              {one ? t("emptyIn", { country: one }) : t("emptyAny")}
            </Display>
            <Link
              href={f.country?.length === 1 ? `/trips/new?country=${f.country[0]}` : "/trips/new"}
              className="press flex min-h-[52px] items-center justify-center rounded-button bg-signal px-4 font-semibold text-ink"
            >
              {t("openFirst")}
            </Link>
            {!f.all && (
              <Link href="/trips?all=1" className="text-sm text-[#c9c9c9] underline-offset-4 hover:underline">
                {t("showAll")}
              </Link>
            )}
          </Panel>
          <h3 className="px-1 pt-2 text-[15px] font-semibold">{t("destinations")}</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {FEATURED_COUNTRIES.map((c) => (
              <Link
                key={c}
                href={`/trips?all=1&country=${c}`}
                className="press relative h-28 overflow-hidden rounded-[18px]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP */}
                <img
                  src={countryPhoto(c, 400)}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 size-full object-cover"
                />
                <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,.55))]" />
                <span className="absolute bottom-2.5 left-3 font-semibold text-white">
                  {countryName(c, locale)}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}

      {(f.page > 1 || hasMore) && (
        <nav className="flex justify-between pt-2">
          {f.page > 1 ? (
            <Link href={page(f.page - 1)} className="min-h-11 px-2 py-3 text-sm font-medium">
              ← {t("prev")}
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link href={page(f.page + 1)} className="min-h-11 px-2 py-3 text-sm font-medium">
              {t("next")} →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
