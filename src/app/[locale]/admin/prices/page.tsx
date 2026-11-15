import { getLocale, getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { COUNTRIES, countryName } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guard";
import { listAllPrices } from "@/modules/admin/service";
import { AdminButton, PriceForm } from "../ui";

const usd = (m: number) => `$${Math.round(m / 100)}`;

// "Haqiqiy narx": editor estimates per destination, length and room type. Saving the same
// destination + days + room replaces the row. Under 5 groups the app shows "taxminiy".
export default async function AdminPrices() {
  await requireAdmin();
  const [rows, t, locale] = await Promise.all([listAllPrices(), getTranslations("admin"), getLocale()]);
  const names = Object.fromEntries(COUNTRIES.map((c) => [c, countryName(c, locale)]));
  return (
    <>
      <Display className="text-[36px]">{t("nav_prices")}</Display>
      <Panel tone="soft" className="text-[15px]">
        {t("pricesNote")}
      </Panel>
      <details className="rounded-panel bg-card p-4" open={rows.length === 0}>
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("addPrice")}</summary>
        <PriceForm names={names} />
      </details>
      <Panel className="flex flex-col p-0 md:p-0">
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <b>
                {names[r.destination]} · {t("daysN", { n: r.days })} ·{" "}
                {t(`room_${r.roomType}` as "room_quad")}
              </b>
              <span className="text-sm text-muted-foreground">
                {usd(r.p25)} – <b>{usd(r.median)}</b> – {usd(r.p75)} · {t("groupsN", { n: r.sampleSize })}
                {r.isSample && ` · ${t("sample")}`}
              </span>
            </span>
            <AdminButton op={{ op: "price.delete", id: r.id }} label={t("delete")} tone="danger" confirm />
          </div>
        ))}
      </Panel>
    </>
  );
}
