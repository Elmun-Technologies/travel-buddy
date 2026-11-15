import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { ExternalLink } from "@/components/external-link";
import { PageLoading } from "@/components/page-loading";
import { BackTo } from "@/components/telegram-actions";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/catalog";
import { formatDay } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { countryPhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";
import {
  COUNT_DAYS,
  type CreatorEntry,
  creatorEnabled,
  GOAL_VIEWS,
  getMyEntries,
  igHandle,
  openOffers,
  POST_DAYS,
} from "@/modules/creator/service";
import { ReelForm } from "./reel-form";

export default function CreatorTrackPage(props: PageProps<"/[locale]/creator">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Track {...props} />
    </Suspense>
  );
}

const eyebrow = "text-sm font-semibold tracking-[.06em] text-muted-foreground uppercase";
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
const STATUS = {
  joined: "bg-signal text-ink",
  tracking: "bg-blue-soft text-blue-ink",
  approved: "bg-success-soft text-success",
  paid: "bg-success-soft text-success",
  rejected: "bg-danger-soft text-danger",
} as const;

// App-Creator-Track: "Mening videom" — the Reel, its views against 1 000 000, and what happens next.
async function Track({ params }: PageProps<"/[locale]/creator">) {
  await connection(); // the flag is a runtime env, never baked at build
  if (!creatorEnabled()) notFound();
  const locale = asLocale((await params).locale);
  const { user } = await requireProfile(locale);
  const [entries, offers, t] = await Promise.all([
    getMyEntries(user.id),
    openOffers(user.id),
    getTranslations("creator"),
  ]);
  const e = entries[0];

  return (
    <>
      <BackTo label={t("back")} href="/home" />
      <div className="-mt-2 text-center">
        <h1 className="font-semibold">{t("trackTitle")}</h1>
        <div className="text-xs text-muted-foreground">{t("title")}</div>
      </div>
      {offers.length > 0 && (
        <Panel className="flex flex-col gap-2">
          <h3 className={eyebrow}>{t("offers")}</h3>
          {offers.map((o) => (
            <Link
              key={o.id}
              href={`/trips/${o.id}/creator`}
              className="press lift flex min-h-11 items-center justify-between rounded-[16px] bg-background px-4 py-3"
            >
              <span className="font-medium">
                {o.title} · {countryName(o.country, locale)}
              </span>
              <span className="text-blue">{t("open")} ↗</span>
            </Link>
          ))}
        </Panel>
      )}
      {e ? (
        <Entry e={e} locale={locale} />
      ) : (
        offers.length === 0 && (
          <Panel className="flex flex-col gap-2 p-6">
            <Display as="h2" className="text-[32px]">
              {t("empty")}
            </Display>
            <p className="text-muted-foreground">{t("emptyText")}</p>
          </Panel>
        )
      )}
    </>
  );
}

async function Entry({ e, locale }: { e: CreatorEntry; locale: string }) {
  const t = await getTranslations("creator");
  const final = e.postedAt ? addDays(e.postedAt, COUNT_DAYS) : null;
  const daysLeft = final ? Math.max(0, daysBetween(e.today, final)) : null;
  const views = e.views ?? 0;
  const pct = Math.min(100, (views / GOAL_VIEWS) * 100);
  const checked = e.status === "approved" || e.status === "paid";
  const fmt = new Intl.NumberFormat(locale === "en" ? "en" : "ru").format; // "640 312" (space groups)

  return (
    <>
      <Panel className="flex items-center gap-4 p-4">
        <span className="relative aspect-[9/16] w-[34%] flex-none overflow-hidden rounded-[22px] border-4 border-ink">
          <Image src={countryPhoto(e.country, 400)} alt="" fill sizes="160px" className="object-cover" />
          {e.views != null && (
            <span className="absolute bottom-3 left-3 text-lg font-semibold text-white">
              ▶ {fmt(e.views)}
            </span>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className={cn("self-start rounded-full px-3 py-1 text-[15px]", STATUS[e.status as "joined"])}>
            {t(`st_${e.status}` as "st_joined")}
          </span>
          <span className="text-xl font-semibold">
            {e.title} · {countryName(e.country, locale)}
          </span>
          {e.postedAt && (
            <span className="text-muted-foreground">
              {daysLeft
                ? t("posted", { date: formatDay(e.postedAt, locale), n: daysLeft })
                : t("postedDone", { date: formatDay(e.postedAt, locale) })}
            </span>
          )}
          {e.instagram && (
            <span className="text-muted-foreground">
              {e.instagram}
              {e.reelUrl && " · ✓"}
            </span>
          )}
        </span>
      </Panel>

      {e.status === "joined" ? (
        <ReelForm
          id={e.id}
          text={t("formText", { date: formatDay(addDays(e.endDate, POST_DAYS), locale), handle: igHandle() })}
        />
      ) : (
        <Panel tone="dark" className="flex flex-col gap-3 p-6">
          <div className="flex justify-between gap-3 text-white/70">
            <h3 className="text-sm font-semibold tracking-[.06em] uppercase">{t("views")}</h3>
            {e.viewsAt && <span>{t("updated", { date: formatDay(e.viewsAt.toISOString(), locale) })}</span>}
          </div>
          <Display as="div" className="text-[64px] leading-none tabular-nums">
            {e.views != null ? fmt(e.views) : "—"}
          </Display>
          <div className="h-4 overflow-hidden rounded-full bg-white/15">
            <div className="grow-x h-full rounded-full bg-signal" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-white/70">
            <span>0</span>
            <span>{t("goal")}</span>
          </div>
          <p className="text-lg">
            {e.views == null
              ? t("noViews")
              : views >= GOAL_VIEWS
                ? t("reached")
                : t.rich("left", {
                    views: fmt(GOAL_VIEWS - views),
                    days: daysLeft ?? 0,
                    y: (c) => <b className="text-signal">{c}</b>,
                  })}
          </p>
        </Panel>
      )}

      <Panel className="flex flex-col gap-2 p-6">
        <h3 className={eyebrow}>{t("costs")}</h3>
        <p className="text-muted-foreground">{t("costsNote")}</p>
      </Panel>

      <Panel className="flex flex-col gap-3 p-6">
        <h3 className={eyebrow}>{t("next")}</h3>
        {e.status === "rejected" ? (
          <p className="text-danger">{t("rejectedNote", { note: e.note ?? "—" })}</p>
        ) : (
          <ul className="flex flex-col gap-3 text-lg">
            {[
              [checked, t("n1")],
              [checked, t("n2")],
              [e.status === "paid", final ? t("n3", { date: formatDay(final, locale) }) : t("n3Wait")],
            ].map(([done, label]) => (
              <li key={label as string} className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex size-7 flex-none items-center justify-center rounded-full",
                    done ? "bg-success text-white" : "border-2 border-line",
                  )}
                >
                  {done && <Check className="size-4" aria-hidden="true" />}
                </span>
                {label}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {e.reelUrl && (
        <ExternalLink
          href={`https://t.me/share/url?url=${encodeURIComponent(e.reelUrl)}`}
          className="press lift mb-6 flex min-h-14 items-center justify-center rounded-full border-2 border-ink text-xl font-semibold"
        >
          {t("share")} ↗
        </ExternalLink>
      )}
    </>
  );
}
