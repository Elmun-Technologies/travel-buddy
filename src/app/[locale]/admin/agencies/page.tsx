import { getTranslations } from "next-intl/server";
import { Display, Panel, clayInput } from "@/components/clay";
import { requireAdmin } from "@/lib/guard";
import { listAgenciesForAdmin } from "@/modules/agencies/service";
import { AdminButton } from "../ui";

export default async function AdminAgencies() {
  await requireAdmin();
  const [t, rows] = await Promise.all([getTranslations("admin"), listAgenciesForAdmin()]);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <Display className="text-[36px]">{t("nav_agencies")}</Display>

      <Panel className="flex flex-col gap-2">
        <span className="font-semibold">{t("exportTitle")}</span>
        <form action="/api/admin/export" className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            {t("exportFrom")}
            <input
              type="date"
              name="from"
              required
              defaultValue={today.slice(0, 8) + "01"}
              className={clayInput}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {t("exportTo")}
            <input type="date" name="to" required defaultValue={today} className={clayInput} />
          </label>
          <button className="min-h-12 rounded-full bg-ink px-6 font-semibold text-white">
            {t("exportGo")}
          </button>
        </form>
      </Panel>

      <Panel className="flex flex-col p-0 md:p-0">
        {rows.length === 0 && <p className="p-4 text-muted-foreground">{t("nothing")}</p>}
        {rows.map((a) => (
          <div key={a.id} className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">
                {a.name} <span className="text-sm font-normal text-muted-foreground">· {a.status}</span>
              </span>
              <span className="flex gap-2">
                {a.status !== "verified" && (
                  <AdminButton op={{ op: "agencyorg.verify", id: a.id }} label={t("agOpen")} tone="dark" />
                )}
                {a.status !== "suspended" && (
                  <AdminButton
                    op={{ op: "agencyorg.suspend", id: a.id }}
                    label={t("agSuspend")}
                    tone="danger"
                    confirm
                  />
                )}
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {[a.legalName, a.taxId && `INN ${a.taxId}`, a.phone, a.website, a.city]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {a.description && <p className="text-sm">{a.description}</p>}
            {a.docs > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">{t("agDocs")}:</span>
                {Array.from({ length: a.docs }, (_, i) => (
                  <a
                    key={i}
                    href={`/api/admin/agency-doc/${a.id}/${i}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm underline"
                  >
                    #{i + 1}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </Panel>
    </>
  );
}
