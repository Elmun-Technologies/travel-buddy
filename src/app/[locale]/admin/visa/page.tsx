import { getLocale, getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { COUNTRIES, countryName, todayISO } from "@/lib/catalog";
import { requireAdmin } from "@/lib/guard";
import { listAllAgencies, listAllVisaRules } from "@/modules/admin/service";
import { AdminButton, AgencyForm, VisaForm } from "../ui";

// Visa rules for the Uzbekistan passport + partner visa agencies. Every rule carries the date it was
// checked and the official source; "Namuna" rows are staging samples and get replaced on save.
export default async function AdminVisa() {
  await requireAdmin();
  const [rules, agencies, t, locale] = await Promise.all([
    listAllVisaRules(),
    listAllAgencies(),
    getTranslations("admin"),
    getLocale(),
  ]);
  const names = Object.fromEntries(COUNTRIES.map((c) => [c, countryName(c, locale)]));
  const today = todayISO();
  return (
    <>
      <Display className="text-[36px]">{t("nav_visa")}</Display>
      <Panel tone="soft" className="text-[15px]">
        {t("visaNote")}
      </Panel>
      <details className="rounded-panel bg-card p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("addRule")}</summary>
        <VisaForm names={names} today={today} />
      </details>
      {rules.map((r) => (
        <details key={r.id} className="rounded-panel bg-card p-4">
          <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 py-2">
            <b>{names[r.destination]}</b>
            <span className="text-sm text-muted-foreground">
              {t(r.status as "visa_free")} · {t("checkedOn", { date: r.checkedAt })}
              {r.isSample && ` · ${t("sample")}`}
            </span>
          </summary>
          <VisaForm initial={r} names={names} today={today} />
          <div className="pt-3">
            <AdminButton
              op={{ op: "visa.delete", destination: r.destination as never }}
              label={t("delete")}
              tone="danger"
              confirm
            />
          </div>
        </details>
      ))}

      <Display as="h2" className="pt-4 text-[28px]">
        {t("agencies")}
      </Display>
      <details className="rounded-panel bg-card p-4">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold">{t("addAgency")}</summary>
        <AgencyForm />
      </details>
      {agencies.map((a) => (
        <details key={a.id} className="rounded-panel bg-card p-4">
          <summary className="flex min-h-11 cursor-pointer flex-wrap items-center gap-2 py-2">
            <b>{a.name}</b>
            <span className="text-sm text-muted-foreground">
              {a.countries.join(", ")} · ★ {a.rating ?? "—"}
              {a.isSample && ` · ${t("sample")}`}
            </span>
          </summary>
          <AgencyForm initial={a} />
          <div className="pt-3">
            <AdminButton op={{ op: "agency.delete", id: a.id }} label={t("delete")} tone="danger" confirm />
          </div>
        </details>
      ))}
    </>
  );
}
