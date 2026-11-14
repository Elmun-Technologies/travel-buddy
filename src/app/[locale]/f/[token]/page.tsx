import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { countryName } from "@/lib/catalog";
import { APP_NAME } from "@/lib/config";
import { formatDay, formatTripDates } from "@/lib/format";
import { asLocale } from "@/lib/guard";
import { countryPhoto } from "@/lib/photos";
import { getFamilyPage } from "@/modules/safety/service";

// Private link: never indexed, never cached by a shared proxy.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function FamilyPage(props: PageProps<"/[locale]/f/[token]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Family {...props} />
    </Suspense>
  );
}

const eyebrow = "text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase";
const ago = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tashkent",
  }).format(new Date(iso));

// App-Family: what a parent needs, nothing about other members beyond counts.
async function Family({ params }: PageProps<"/[locale]/f/[token]">) {
  const { locale: l, token } = await params;
  const locale = asLocale(l);
  const f = await getFamilyPage(token);
  if (!f) notFound();
  const t = await getTranslations("family");
  const country = countryName(f.country, locale);
  const dayDate = (day: number) => {
    if (f.datePrecision !== "exact") return null;
    const d = new Date(`${f.startDate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + day - 1);
    return formatDay(d.toISOString().slice(0, 10), locale);
  };
  const map = (lat: number, lng: number) => `https://maps.google.com/?q=${lat},${lng}`;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-2 px-3 py-3">
      <header className="flex items-center justify-between px-1 py-2">
        <span className="text-lg font-semibold">{APP_NAME}</span>
        <span className="text-sm text-muted-foreground">{t("forFamily")}</span>
      </header>

      <section className="relative h-[190px] overflow-hidden rounded-panel">
        <Image
          src={countryPhoto(f.country, 1200, f.city)}
          alt=""
          fill
          priority
          sizes="480px"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute inset-x-4 bottom-3 text-white">
          <p className="text-[15px]">{t("whose", { name: f.travelerName })}</p>
          <Display className="text-[36px] leading-[1.02]">
            {country} · {formatTripDates(f, locale)}
          </Display>
        </div>
      </section>

      {f.sos && (
        <Panel className="flex flex-col gap-1 bg-danger text-white" role="alert">
          <span className="text-lg font-semibold">{t("sos", { name: f.travelerName })}</span>
          <span className="text-[15px]">{ago(f.sos.at, locale)}</span>
          {f.sos.lat != null && f.sos.lng != null && (
            <a
              href={map(f.sos.lat, f.sos.lng)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-11 py-2 font-semibold underline"
            >
              {t("onMap")}
            </a>
          )}
        </Panel>
      )}

      {f.checkin ? (
        <Panel className="flex items-center gap-4 bg-success-soft">
          <span className="flex size-12 flex-none items-center justify-center rounded-full bg-success text-white">
            <Check className="size-6" aria-hidden="true" />
          </span>
          <span className="flex flex-col text-success">
            <span className="text-lg font-semibold">{t("allGood")}</span>
            <span className="text-[15px]">{t("markedAt", { time: ago(f.checkin.at, locale) })}</span>
          </span>
        </Panel>
      ) : (
        <Panel className="text-[15px] text-muted-foreground">
          {t("noCheckin", { name: f.travelerName })}
        </Panel>
      )}

      {f.location && (
        <Panel className="flex items-center justify-between gap-3">
          <span className="flex flex-col">
            <span className="font-semibold">{t("sharing")}</span>
            <span className="text-sm text-muted-foreground">{ago(f.location.at, locale)}</span>
          </span>
          <a
            href={map(f.location.lat, f.location.lng)}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-11 py-3 font-medium underline"
          >
            {t("onMap")}
          </a>
        </Panel>
      )}

      <Panel className="flex flex-col gap-4">
        <h2 className={eyebrow}>{t("withWhom")}</h2>
        {f.organizer && (
          <div className="flex items-center gap-4">
            <span className="flex size-14 flex-none items-center justify-center rounded-full bg-[#cfdae6] text-xl font-semibold">
              {f.organizer.name.slice(0, 1)}
            </span>
            <div className="min-w-0">
              <div className="text-lg font-semibold">
                {f.organizer.name} · {t("organizer")}
              </div>
              <div className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
                {f.organizer.phone && <span>✓ {t("phone")}</span>}
                {f.organizer.id && <span>✓ {t("document")}</span>}
                {f.organizer.reliability && (
                  <span>
                    {t("went", { went: f.organizer.reliability.went, total: f.organizer.reliability.total })}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Stat n={String(f.size)} label={t("inGroup")} />
          {f.ratio ? (
            <Stat n={`${f.ratio.female} / ${f.ratio.male}`} label={t("ratio")} />
          ) : (
            <Stat n={String(f.size)} label={t("people")} />
          )}
          <Stat n={`${f.verified}/${f.size}`} label={t("verified")} />
        </div>
        {f.womenOnly && <p className="font-semibold">{t("womenOnly")}</p>}
      </Panel>

      {f.plan.length > 0 && (
        <Panel className="flex flex-col gap-2">
          <h2 className={eyebrow}>{t("whereWhen")}</h2>
          {f.plan.map((p, i) => (
            <p key={i} className="text-[17px]">
              <b>{dayDate(p.day) ?? t("day", { n: p.day })}</b> · {p.place}
              {p.note && <span className="text-muted-foreground"> — {p.note}</span>}
            </p>
          ))}
        </Panel>
      )}

      {f.emergency && (
        <Panel tone="dark" className="flex flex-col">
          <h2 className="pb-1 text-xs font-semibold tracking-[.06em] text-[#c9c9c9] uppercase">
            {t("emergency")}
          </h2>
          <a href={`tel:${f.emergency}`} className="flex min-h-16 items-center justify-between gap-3">
            <span className="text-[17px]">{t("localNumber", { country })}</span>
            <span className="font-display text-[44px] leading-none text-signal">{f.emergency}</span>
          </a>
        </Panel>
      )}

      {f.telegramId && (
        <a
          href={`tg://user?id=${f.telegramId}`}
          className="press flex min-h-14 items-center justify-center rounded-full bg-blue text-lg font-semibold text-white"
        >
          {t("write", { name: f.travelerName })}
        </a>
      )}
      <p className="px-2 text-center text-sm text-muted-foreground">
        {t("footer", { name: f.travelerName })}
      </p>
    </main>
  );
}

function Stat({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[18px] bg-background px-4 py-3">
      <span className="font-display text-[34px] leading-none">{n}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
