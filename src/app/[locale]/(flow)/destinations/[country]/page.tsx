import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { BackTo, MainAction } from "@/components/telegram-actions";
import { Link } from "@/i18n/navigation";
import { COUNTRIES, countryName } from "@/lib/catalog";
import { destinationFacts } from "@/lib/destinations";
import { formatTripDates } from "@/lib/format";
import { asLocale } from "@/lib/guard";
import { countryPhoto } from "@/lib/photos";
import { getSessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getPrices, getVisaRule } from "@/modules/destinations/service";
import { rankTrips, travelerFor } from "@/modules/matching/service";
import { getOwnProfile } from "@/modules/profiles/service";
import { feedFilterSchema } from "@/modules/trips/schema";
import { listFeed } from "@/modules/trips/service";
import { CountryMusic, SaveDestination } from "./client";

export default function DestinationPage(props: PageProps<"/[locale]/destinations/[country]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Destination {...props} />
    </Suspense>
  );
}

const glass =
  "flex min-h-11 items-center gap-1 rounded-full bg-white/90 px-4 text-[15px] font-medium text-ink backdrop-blur";
const chip =
  "rounded-full border border-white/50 bg-black/25 px-3 py-1.5 text-[13px] text-white backdrop-blur";
const VISA = {
  visa_free: "bg-success-soft text-success",
  evisa: "bg-blue-soft text-blue-ink",
  visa_required: "bg-danger-soft text-danger",
} as const;

// App-Destination: photo, what it's good for, visa, real price, forming groups, one main action.
// Opening it plays the country's short tune (src/lib/music.ts).
async function Destination({ params }: PageProps<"/[locale]/destinations/[country]">) {
  const { locale: l, country: raw } = await params;
  const locale = asLocale(l);
  const country = raw.toUpperCase();
  if (!(COUNTRIES as readonly string[]).includes(country)) notFound();
  const user = await getSessionUser();
  const [t, visa, prices, feed, profile] = await Promise.all([
    getTranslations("destination"),
    getVisaRule(country),
    getPrices(country),
    listFeed(user?.id ?? null, feedFilterSchema.parse({ country, all: "1" })),
    user ? getOwnProfile(user.id) : null,
  ]);
  const traveler = user ? await travelerFor(user.id) : null;
  const matches = new Map(
    traveler ? (await rankTrips(traveler, feed.items)).map((x) => [x.trip.id, x.match.percent]) : [],
  );
  const name = countryName(country, locale);
  const facts = destinationFacts(country);
  const price = prices[0];
  const people = feed.items.reduce((s, x) => s + x.approvedCount, 0);
  const gallery = facts.gallery.length ? facts.gallery : [];

  return (
    <>
      <section className="relative -mx-3 -mt-3 h-[420px] overflow-hidden rounded-b-panel">
        <Image
          src={facts.hero ? `/photos/${facts.hero}-1200.webp` : countryPhoto(country, 1200)}
          alt={name}
          fill
          priority
          sizes="480px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-black/20" />
        <div className="absolute inset-x-3 top-3 flex items-center justify-between gap-2">
          <BackTo label={`← ${t("back")}`} href="/trips" className={glass} />
          <span className="ml-auto flex gap-2">
            <CountryMusic country={country} />
            <SaveDestination
              country={country}
              initial={!!profile?.dreamDestinations.includes(country)}
              signedIn={!!profile}
            />
          </span>
        </div>
        <div className="absolute inset-x-5 bottom-5 flex flex-col gap-3 text-white">
          <div className="flex flex-wrap gap-1.5">
            {visa?.status === "visa_free" && <span className={chip}>{t("visaFree")}</span>}
            {facts.flightHours && <span className={chip}>{t("flight", { h: facts.flightHours })}</span>}
            {facts.styles.length > 0 && (
              <span className={chip}>
                {facts.styles.map((s) => t(`short_${s}` as "short_city")).join(" · ")}
              </span>
            )}
          </div>
          <Display className="text-[64px] leading-none">{name}</Display>
        </div>
      </section>

      {gallery.length > 1 && (
        <div className="grid grid-cols-3 gap-2">
          {gallery.slice(0, 3).map((g) => (
            <Image
              key={g}
              src={`/photos/${g}-400.webp`}
              alt=""
              width={200}
              height={140}
              className="rise aspect-[4/3] w-full rounded-[18px] object-cover"
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat n={String(feed.total)} label={t("groups")} />
        <Stat n={String(people)} label={t("travelers")} />
        <Stat n="—" label={t("rating")} tone="signal" />
      </div>

      {(visa || price) && (
        <div className="grid grid-cols-2 gap-2">
          {visa ? (
            <Link
              href={`/visa?c=${country}`}
              className={cn("press lift rounded-panel p-4", VISA[visa.status as keyof typeof VISA])}
            >
              <span className="text-xs font-semibold tracking-[.06em] uppercase">{t("visa")}</span>
              <span className="mt-1 block text-lg font-semibold">
                {t(`visa_${visa.status}` as "visa_visa_free")}
                {visa.maxStayDays ? ` · ${t("upTo", { n: visa.maxStayDays })}` : ""}
              </span>
              <span className="mt-1 block text-sm">
                {t("documents")} {"↗"}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {price && (
            <Link
              href={`/price/${country}?days=${price.days}`}
              className="press lift rounded-panel bg-ink p-4 text-white"
            >
              <span className="text-xs font-semibold tracking-[.06em] text-[#c9c9c9] uppercase">
                {t("realPrice")}
              </span>
              <span className="mt-1 block font-display text-[34px] leading-none text-signal">
                ${Math.round(price.median / 100)}
              </span>
              <span className="mt-1 block text-sm text-[#c9c9c9]">
                {t("priceNote", { days: price.days })} {"↗"}
              </span>
            </Link>
          )}
        </div>
      )}

      <section className="flex flex-col gap-2 pt-3">
        <div className="flex items-baseline justify-between px-1">
          <Display as="h2" className="text-[32px]">
            {t("groupsTitle")}
          </Display>
          {feed.total > 3 && (
            <Link
              href={`/trips?all=1&country=${country}`}
              className="min-h-11 py-3 text-[15px] underline underline-offset-4"
            >
              {t("all")}
            </Link>
          )}
        </div>
        {feed.items.length === 0 && (
          <Panel className="text-muted-foreground">{t("noGroups", { country: name })}</Panel>
        )}
        {feed.items.slice(0, 3).map((g, i) => (
          <Link
            key={g.id}
            href={`/trips/${g.id}`}
            className="press lift flex items-center gap-4 rounded-panel bg-card p-3"
          >
            <Image
              src={countryPhoto(g.destinationCountry, 400, g.destinationCity)}
              alt=""
              width={80}
              height={80}
              className="size-20 flex-none rounded-[16px] object-cover"
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-2 text-lg leading-tight font-semibold">{g.title}</span>
              <span className="text-[15px] text-muted-foreground">
                {formatTripDates(g, locale)}
                {g.groupSizeMax ? ` · ${g.approvedCount}/${g.groupSizeMax}` : ""}
                {matches.get(g.id) != null && ` · ${t("match", { n: matches.get(g.id)! })}`}
              </span>
            </span>
            {i === 0 && (
              <span
                className="flex size-14 flex-none items-center justify-center rounded-full bg-signal text-xl"
                aria-hidden="true"
              >
                {"↗"}
              </span>
            )}
          </Link>
        ))}
      </section>

      <Panel tone="dark" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold tracking-[.06em] text-[#c9c9c9] uppercase">
            {t("famous")}
          </span>
          <span className="rounded-full bg-signal px-3 py-1.5 text-sm font-medium text-ink">{t("soon")}</span>
        </div>
        <div className="flex gap-3" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="size-[72px] rounded-full border border-dashed border-white/30 bg-white/5"
            />
          ))}
        </div>
        <p className="text-[15px] text-[#c9c9c9]">{t("famousText")}</p>
      </Panel>

      <div className="h-20" />
      <MainAction label={t("go", { country: name })} href={`/trips/new?country=${country}`} />
    </>
  );
}

function Stat({ n, label, tone }: { n: string; label: string; tone?: "signal" }) {
  return (
    <div
      className={cn(
        "rise flex flex-col gap-1 rounded-panel px-4 py-3",
        tone === "signal" ? "bg-signal" : "bg-card",
      )}
    >
      <span className="font-display text-[40px] leading-none">{n}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
