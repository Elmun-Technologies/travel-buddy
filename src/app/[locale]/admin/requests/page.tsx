import { getLocale, getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/catalog";
import { formatBudget } from "@/lib/format";
import { requireAdmin } from "@/lib/guard";
import { listAgencyRequests } from "@/modules/admin/service";
import { AdminButton, OfferForm } from "../ui";

// "Tayyor tur so'raymiz" (product-decisions §4, MVP by hand): send the brief to 3–5 partner agencies,
// enter their answers here — they appear in the group's Yig'amiz tab at once, sorted by price.
export default async function AdminRequests() {
  await requireAdmin();
  const [rows, t, ts, locale] = await Promise.all([
    listAgencyRequests(),
    getTranslations("admin"),
    getTranslations("styles"),
    getLocale(),
  ]);
  return (
    <>
      <Display className="text-[36px]">{t("nav_requests")}</Display>
      <Panel tone="soft" className="text-[15px]">
        {t("requestsNote")}
      </Panel>
      {rows.length === 0 && <Panel className="text-muted-foreground">{t("noRequests")}</Panel>}
      {rows.map((r) => (
        <Panel key={r.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/trips/${r.tripId}`} className="text-xl font-semibold hover:underline">
              {r.title}
            </Link>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${r.status === "new" ? "bg-signal" : "bg-background"}`}
            >
              {t(`req_${r.status}` as "req_new")}
            </span>
          </div>
          {/* The brief for agencies: no personal data (product-decisions §4.B). */}
          <p className="rounded-[14px] bg-background p-3 font-mono text-sm whitespace-pre-line">
            {t("brief", {
              country: countryName(r.country, locale),
              from: r.startDate,
              to: r.endDate,
              people: r.people,
              budget: formatBudget(r.budgetMin, r.budgetMax, "USD") ?? "—",
              styles: r.styles.map((x) => ts(x as "city")).join(", ") || "—",
            })}
          </p>
          {r.offers.length > 0 && (
            <div className="flex flex-col gap-1">
              {r.offers.map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-0"
                >
                  <span>
                    <b>{o.title}</b> {o.detail && <span className="text-muted-foreground">· {o.detail}</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    <b>${Math.round((o.price ?? 0) / 100)}</b>
                    <AdminButton op={{ op: "offer.remove", id: o.id }} label={t("remove")} confirm />
                  </span>
                </div>
              ))}
            </div>
          )}
          <OfferForm tripId={r.tripId} />
          <div className="flex flex-wrap gap-2">
            {r.status === "new" && (
              <AdminButton op={{ op: "request.status", id: r.id, status: "sent" }} label={t("markSent")} />
            )}
            {r.status !== "closed" && (
              <AdminButton op={{ op: "request.status", id: r.id, status: "closed" }} label={t("close")} />
            )}
          </div>
        </Panel>
      ))}
    </>
  );
}
