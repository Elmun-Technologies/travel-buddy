import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/guard";
import { listAllClubsForAdmin } from "@/modules/clubs/service";
import { AdminButton } from "../ui";

export default async function AdminClubs() {
  await requireAdmin();
  const [t, rows] = await Promise.all([getTranslations("admin"), listAllClubsForAdmin()]);
  return (
    <>
      <Display className="text-[36px]">{t("nav_clubs")}</Display>
      <Panel className="flex flex-col p-0 md:p-0">
        {rows.length === 0 && <p className="p-4 text-muted-foreground">{t("nothing")}</p>}
        {rows.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <Link href={`/clubs/${c.id}`} className="font-semibold hover:underline">
                {c.name}
              </Link>
              <span className="text-sm text-muted-foreground">
                {c.privacy} · {c.createdAt.toISOString().slice(0, 10)} · {c.status}
              </span>
            </span>
            {c.status === "active" ? (
              <AdminButton op={{ op: "club.hide", id: c.id }} label={t("hide")} tone="danger" confirm />
            ) : (
              <AdminButton op={{ op: "club.restore", id: c.id }} label={t("restore")} />
            )}
          </div>
        ))}
      </Panel>
    </>
  );
}
