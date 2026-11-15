import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/guard";
import { listOpenReports } from "@/modules/admin/service";
import { AdminButton } from "../ui";

const URGENT = new Set(["dating", "unsafe"]);

// Reports queue: urgent reasons first ("tanishuv", "xavfli" — product-decisions §5: 24 hours).
export default async function AdminReports() {
  await requireAdmin();
  const [rows, t] = await Promise.all([listOpenReports(), getTranslations("admin")]);
  return (
    <>
      <Display className="text-[36px]">{t("nav_reports")}</Display>
      {rows.length === 0 && <Panel className="text-muted-foreground">{t("noReports")}</Panel>}
      {rows.map((r) => (
        <Panel key={r.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2.5 py-1 font-semibold ${URGENT.has(r.reason) ? "bg-danger text-white" : "bg-background"}`}
            >
              {t(`reason_${r.reason}` as "reason_other")}
            </span>
            <span className="text-muted-foreground">
              {t(`target_${r.targetType}` as "target_user")} · {r.reporter ?? "—"} ·{" "}
              {r.createdAt.slice(0, 16).replace("T", " ")}
            </span>
            {r.hidden && <span className="rounded-full bg-background px-2.5 py-1">{t("alreadyHidden")}</span>}
          </div>
          <p className="text-[17px] whitespace-pre-wrap">{r.text ?? t("gone")}</p>
          <div className="flex flex-wrap gap-2">
            {r.targetType === "message" && !r.hidden && (
              <AdminButton
                op={{ op: "message.hide", id: r.targetId, reportId: r.id }}
                label={t("hideMessage")}
                tone="dark"
              />
            )}
            {r.targetType === "trip" && (
              <>
                <Link
                  href={`/trips/${r.targetId}`}
                  className="flex min-h-10 items-center px-2 text-sm underline"
                >
                  {t("open")}
                </Link>
                {!r.hidden && (
                  <AdminButton
                    op={{ op: "trip.hide", id: r.targetId, reportId: r.id }}
                    label={t("hideTrip")}
                    tone="dark"
                  />
                )}
              </>
            )}
            {r.authorId && (
              <AdminButton
                op={{ op: "user.suspend", id: r.authorId, reportId: r.id }}
                label={t("suspendAuthor")}
                tone="danger"
                confirm
              />
            )}
            <AdminButton
              op={{ op: "report.close", id: r.id, resolution: "dismissed" }}
              label={t("dismiss")}
            />
          </div>
        </Panel>
      ))}
    </>
  );
}
