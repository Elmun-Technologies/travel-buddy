import { getTranslations } from "next-intl/server";
import { Display, Panel, clayInput } from "@/components/clay";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/guard";
import { searchTrips } from "@/modules/admin/service";
import { AdminButton } from "../ui";

export default async function AdminTrips({ searchParams }: PageProps<"/[locale]/admin/trips">) {
  await requireAdmin();
  const q = String((await searchParams).q ?? "");
  const [rows, t] = await Promise.all([searchTrips(q), getTranslations("admin")]);
  return (
    <>
      <Display className="text-[36px]">{t("nav_trips")}</Display>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("searchTrips")}
          aria-label={t("searchTrips")}
          className={clayInput}
        />
        <button className="min-h-12 rounded-full bg-ink px-6 font-semibold text-white">{t("search")}</button>
      </form>
      <Panel className="flex flex-col p-0 md:p-0">
        {rows.length === 0 && <p className="p-4 text-muted-foreground">{t("nothing")}</p>}
        {rows.map((x) => (
          <div
            key={x.id}
            className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <Link href={`/trips/${x.id}`} className="font-semibold hover:underline">
                {x.title}
              </Link>
              <span className="text-sm text-muted-foreground">
                {x.country} · {x.startDate} · {x.owner ?? "—"} · {x.status}
                {x.isTest && ` · ${t("sample")}`}
              </span>
            </span>
            {x.status === "hidden" ? (
              <AdminButton op={{ op: "trip.restore", id: x.id }} label={t("restore")} />
            ) : (
              <AdminButton op={{ op: "trip.hide", id: x.id }} label={t("hideTrip")} tone="danger" confirm />
            )}
          </div>
        ))}
      </Panel>
    </>
  );
}
