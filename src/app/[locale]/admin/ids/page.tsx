import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { requireAdmin } from "@/lib/guard";
import { listPendingIds } from "@/modules/verification/service";
import { AdminButton } from "../ui";

export default async function AdminIds() {
  await requireAdmin();
  const [t, rows] = await Promise.all([getTranslations("admin"), listPendingIds()]);
  return (
    <>
      <Display className="text-[36px]">{t("idTitle")}</Display>
      <p className="text-sm text-muted-foreground">{t("idHint")}</p>
      {rows.length === 0 && <Panel className="text-muted-foreground">{t("idEmpty")}</Panel>}
      {rows.map((r) => (
        <Panel key={r.id} className="flex flex-col gap-3">
          <div className="font-semibold">
            {r.name} · {r.createdAt.toISOString().slice(0, 16).replace("T", " ")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["doc", "selfie"] as const).map((k) => (
              <a
                key={k}
                href={`/api/admin/id/${r.id}/${k}`}
                target="_blank"
                rel="noreferrer"
                className="block"
              >
                <span className="text-xs text-muted-foreground">
                  {k === "doc" ? t("idDoc") : t("idSelfie")}
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element -- private picture, admin only */}
                <img
                  src={`/api/admin/id/${r.id}/${k}`}
                  alt={k === "doc" ? t("idDoc") : t("idSelfie")}
                  className="mt-1 aspect-[4/3] w-full rounded-[12px] bg-background object-contain"
                />
              </a>
            ))}
          </div>
          <div className="flex gap-2">
            <AdminButton op={{ op: "id.approve", id: r.id }} label={t("approve")} tone="dark" />
            <AdminButton op={{ op: "id.reject", id: r.id }} label={t("reject")} tone="danger" confirm />
          </div>
        </Panel>
      ))}
    </>
  );
}
