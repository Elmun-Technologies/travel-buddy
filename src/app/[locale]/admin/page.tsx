import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/guard";
import { adminCounts } from "@/modules/admin/service";

export default async function AdminHome() {
  await requireAdmin();
  const [c, t] = await Promise.all([adminCounts(), getTranslations("admin")]);
  const tiles = [
    { n: c.openReports, label: t("openReports"), href: "/admin/reports", hot: c.openReports > 0 },
    { n: c.newRequests, label: t("newRequests"), href: "/admin/requests", hot: c.newRequests > 0 },
    { n: c.openTrips, label: t("openTrips"), href: "/admin/trips", hot: false },
    { n: c.users, label: t("usersCount"), href: "/admin/users", hot: false },
  ];
  return (
    <>
      <Display className="text-[36px]">{t("title")}</Display>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {tiles.map((x) => (
          <Link
            key={x.href}
            href={x.href}
            className={`press lift rounded-panel p-4 ${x.hot ? "bg-signal" : "bg-card"}`}
          >
            <span className="font-display text-[44px] leading-none">{x.n}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{x.label}</span>
          </Link>
        ))}
      </div>
      <Panel className="text-[15px] text-muted-foreground">{t("homeNote")}</Panel>
    </>
  );
}
