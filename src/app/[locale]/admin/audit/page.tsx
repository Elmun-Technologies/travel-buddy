import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { requireAdmin } from "@/lib/guard";
import { listAudit } from "@/modules/admin/service";

// Who did what, when (CLAUDE.md §4.10). Read-only.
export default async function AdminAudit() {
  await requireAdmin();
  const [rows, t] = await Promise.all([listAudit(), getTranslations("admin")]);
  return (
    <>
      <Display className="text-[36px]">{t("nav_audit")}</Display>
      <Panel className="flex flex-col p-0 md:p-0">
        {rows.length === 0 && <p className="p-4 text-muted-foreground">{t("nothing")}</p>}
        {rows.map((r) => (
          <div
            key={r.id}
            className="flex flex-col gap-0.5 border-b border-line px-4 py-3 text-sm last:border-0"
          >
            <span>
              <b>{r.actor ?? "—"}</b> · <code>{r.action}</code>
              {r.targetId && <span className="text-muted-foreground"> · {r.targetId.slice(0, 8)}</span>}
            </span>
            <span className="text-muted-foreground">
              {r.createdAt.toISOString().slice(0, 19).replace("T", " ")} UTC
            </span>
          </div>
        ))}
      </Panel>
    </>
  );
}
