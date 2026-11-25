import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { Link } from "@/i18n/navigation";
import { formatTripDates } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { storageEnabled } from "@/lib/storage";
import { agencyDocCount, agencyOf, agencyStats, listLeads, listOffers } from "@/modules/agencies/service";
import { DocUpload, LeadActions, OfferToggle } from "./ui";

export default function AgencyPage(props: PageProps<"/[locale]/agency">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Agency {...props} />
    </Suspense>
  );
}

const label = "text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase";

async function Agency({ params }: PageProps<"/[locale]/agency">) {
  const locale = asLocale((await params).locale);
  const { user } = await requireProfile(locale);
  const t = await getTranslations("agency");
  const mine = await agencyOf(user.id);
  if (!mine)
    return (
      <div className="flex flex-col gap-2">
        <Display className="px-1 pt-2 text-[34px]">{t("title")}</Display>
        <p className="px-1 text-[15px] text-muted-foreground">{t("intro")}</p>
        <Link
          href="/agency/register"
          className="press flex min-h-[52px] items-center justify-center rounded-button bg-ink px-4 font-semibold text-white"
        >
          {t("registerCta")}
        </Link>
      </div>
    );

  const a = mine.agency;
  const [stats, offers, leads, docs] = await Promise.all([
    agencyStats(a.id),
    listOffers(a.id),
    listLeads(a.id),
    agencyDocCount(a.id),
  ]);
  const verified = a.status === "verified";
  return (
    <div className="flex flex-col gap-2">
      <Display className="px-1 pt-2 text-[34px]">{a.name}</Display>
      <Panel
        tone={verified ? "soft" : a.status === "suspended" ? "light" : "signal"}
        className="flex flex-col gap-2"
      >
        <span className="font-semibold">
          {verified
            ? t("statusVerified")
            : a.status === "pending"
              ? t("statusPending")
              : t("statusSuspended")}
        </span>
        {a.status === "pending" && (
          <>
            <p className="text-sm">{t("pendingText")}</p>
            <p className="text-sm">{t("docs", { n: docs })}</p>
            {mine.role === "owner" && storageEnabled() && <DocUpload />}
          </>
        )}
        {a.status === "suspended" && <p className="text-sm">{t("suspendedText")}</p>}
      </Panel>

      {verified && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {[
              [t("statViews"), stats.views],
              [t("statLeads"), stats.leads],
              [t("statNew"), stats.newLeads],
              [t("statBookings"), stats.bookings],
              [t("statFill"), `${stats.fill}%`],
            ].map(([l, n]) => (
              <Panel key={String(l)} className="flex flex-col gap-1 p-3 md:p-3">
                <span className="font-display text-[28px] leading-none">{n}</span>
                <span className="text-xs text-muted-foreground">{l}</span>
              </Panel>
            ))}
          </div>

          <Panel className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <span className={label}>{t("offers")}</span>
              <Link
                href="/agency/offers/new"
                className="press inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-white"
              >
                {t("newOffer")}
              </Link>
            </div>
            {offers.length === 0 && <p className="text-sm text-muted-foreground">{t("noOffers")}</p>}
            {offers.map((o) => (
              <div
                key={o.id}
                className="flex flex-col gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0"
              >
                <Link href={`/trips/${o.id}`} className="font-semibold underline-offset-4 hover:underline">
                  {o.title}
                </Link>
                <span className="text-sm text-muted-foreground">
                  {formatTripDates({ startDate: o.start, endDate: o.end, datePrecision: "exact" }, locale)} ·{" "}
                  {t("seats", { left: o.seatsAvailable, total: o.seatsTotal })} · {t("statViews")} {o.views} ·{" "}
                  {t("statLeads")} {o.leads}
                </span>
                <span className="flex flex-wrap gap-2">
                  <Link
                    href={`/agency/offers/${o.id}`}
                    className="inline-flex min-h-11 items-center rounded-full border border-input px-4 text-sm font-medium"
                  >
                    {t("edit")}
                  </Link>
                  <OfferToggle tripId={o.id} closed={o.status === "closed"} />
                </span>
              </div>
            ))}
          </Panel>

          <Panel className="flex flex-col gap-3">
            <span className={label}>{t("leads")}</span>
            {leads.length === 0 && <p className="text-sm text-muted-foreground">{t("noLeads")}</p>}
            {leads.map((l) => (
              <div
                key={l.id}
                className="flex flex-col gap-1 border-t border-line pt-3 first:border-t-0 first:pt-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{l.name}</span>
                  <span className="rounded-full border border-input px-2.5 py-0.5 text-xs">
                    {t(`lStatus.${l.status}` as "lStatus.new")}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {l.tripTitle} · {t("people", { n: l.people })}
                  {l.amount != null && ` · $${(l.amount / 100).toFixed(0)}`}
                </span>
                {l.message && <p className="text-sm whitespace-pre-line">{l.message}</p>}
                {l.phone && (
                  <a
                    href={`tel:${l.phone}`}
                    className="min-h-11 py-2.5 text-sm font-medium underline underline-offset-4"
                  >
                    {t("phoneLabel")}: {l.phone}
                  </a>
                )}
                <LeadActions leadId={l.id} status={l.status} conversationId={l.conversationId} />
              </div>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}
