import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { MainAction, TitleBar } from "@/components/telegram-actions";
import { Link } from "@/i18n/navigation";
import { COUNTRIES, countryName } from "@/lib/catalog";
import { asLocale } from "@/lib/guard";
import { countryPhoto } from "@/lib/photos";
import { getSessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getPrices } from "@/modules/destinations/service";
import { listMyTrips } from "@/modules/trips/service";

export default function PricePage(props: PageProps<"/[locale]/price/[country]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Price {...props} />
    </Suspense>
  );
}

const usd = (minor: number) => `$${Math.round(minor / 100)}`;
const ROOMS = ["quad", "double", "single"] as const;
const AUTO_MIN = 5; // fewer groups than this → editor estimate, marked "taxminiy"

// App-Price: per person, by room type, with what the money goes on. Agencies quote the same breakdown.
async function Price({ params, searchParams }: PageProps<"/[locale]/price/[country]">) {
  const { locale: l, country } = await params;
  const locale = asLocale(l);
  if (!(COUNTRIES as readonly string[]).includes(country)) notFound();
  const sp = await searchParams;
  const days = Number(sp.days) > 0 ? Number(sp.days) : undefined;
  const [stats, t, user] = await Promise.all([
    getPrices(country, days),
    getTranslations("price"),
    getSessionUser(),
  ]);
  const name = countryName(country, locale);
  const room = ROOMS.find((r) => r === sp.room && stats.some((s) => s.roomType === r)) ?? stats[0]?.roomType;
  const s = stats.find((x) => x.roomType === room);
  const max = s ? Math.max(...s.items.map((i) => i.amount), 1) : 1;
  const double = stats.find((x) => x.roomType === "double");
  const doubleStay = double?.items.find((i) => i.key === "stay")?.amount;

  // "Ask for this price": your group's room if you have a trip there, otherwise start one.
  const mine = user
    ? (await listMyTrips(user.id)).find(
        (x) => x.destinationCountry === country && x.myStatus.status === "approved",
      )
    : null;

  return (
    <>
      <TitleBar
        back={t("back")}
        href={mine ? `/trips/${mine.id}/room` : "/visa"}
        title={t("title")}
        sub={s ? t("sub", { country: name, days: s.days }) : name}
      />

      <section className="relative h-[190px] overflow-hidden rounded-panel">
        <Image
          src={countryPhoto(country, 1200)}
          alt=""
          fill
          priority
          sizes="480px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-x-4 bottom-3 text-white">
          {s && (
            <p className="text-[15px]">
              {s.sampleSize >= AUTO_MIN ? t("groups", { n: s.sampleSize }) : t("estimate")}
            </p>
          )}
          <Display className="text-[40px] leading-[1.02]">{t("perPerson")}</Display>
        </div>
      </section>

      {!s ? (
        <Panel className="text-muted-foreground">{t("empty", { country: name })}</Panel>
      ) : (
        <>
          <nav className="grid grid-cols-3 gap-1 rounded-full bg-card p-1" aria-label={t("roomType")}>
            {ROOMS.map((r) => {
              const q = new URLSearchParams({ room: r, ...(days ? { days: String(days) } : {}) });
              return stats.some((x) => x.roomType === r) ? (
                <Link
                  key={r}
                  href={`/price/${country}?${q}`}
                  aria-current={room === r ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 items-center justify-center rounded-full text-[15px]",
                    room === r ? "bg-ink font-semibold text-white" : "text-muted-foreground",
                  )}
                >
                  {t(`room_${r}`)}
                </Link>
              ) : (
                <span
                  key={r}
                  className="flex min-h-12 items-center justify-center text-[15px] text-muted-foreground/50"
                >
                  {t(`room_${r}`)}
                </span>
              );
            })}
          </nav>

          <Panel tone="dark" className="flex flex-col gap-2">
            <span className="text-xs font-semibold tracking-[.06em] text-[#c9c9c9] uppercase">
              {t("usually")}
            </span>
            <Display as="div" className="text-[56px] leading-none text-signal">
              {usd(s.median)}
            </Display>
            <span className="text-[15px] text-[#c9c9c9]">
              {t("range", { from: usd(s.p25), to: usd(s.p75) })}
            </span>
            {s.isSample && (
              <span className="self-start rounded-full bg-signal px-2.5 py-1 text-xs font-semibold text-ink">
                {t("sample")}
              </span>
            )}
          </Panel>

          {s.items.length > 0 && (
            <Panel className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase">
                {t("whereGoes")}
              </h2>
              {s.items.map((i) => (
                <div key={i.key} className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[17px]">
                    <span>{t(`item_${i.key}` as "item_flight")}</span>
                    <b>{usd(i.amount)}</b>
                  </div>
                  <div className="h-2.5 rounded-full bg-background">
                    <div
                      className="grow-x h-full rounded-full bg-ink"
                      style={{ width: `${(i.amount / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
              {room === "quad" && double && doubleStay != null && (
                <p className="text-[15px] text-muted-foreground">
                  {t("doubleNote", { stay: usd(doubleStay), total: usd(double.median) })}
                </p>
              )}
            </Panel>
          )}

          <Panel tone="soft" className="flex flex-col gap-1">
            <span className="text-xl font-semibold text-blue-ink">{t("agencies")}</span>
            <span className="text-[15px] text-blue-ink/80">{t("agenciesText")}</span>
          </Panel>
          <div className="h-20" />
          <MainAction
            label={t("ask")}
            href={mine ? `/trips/${mine.id}/room` : `/trips/new?country=${country}`}
          />
        </>
      )}
    </>
  );
}
