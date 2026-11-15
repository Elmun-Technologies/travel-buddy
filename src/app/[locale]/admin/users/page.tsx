import { getTranslations } from "next-intl/server";
import { Display, Panel, clayInput } from "@/components/clay";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/guard";
import { searchUsers } from "@/modules/admin/service";
import { AdminButton } from "../ui";

export default async function AdminUsers({ searchParams }: PageProps<"/[locale]/admin/users">) {
  await requireAdmin();
  const q = String((await searchParams).q ?? "");
  const [rows, t] = await Promise.all([searchUsers(q), getTranslations("admin")]);
  return (
    <>
      <Display className="text-[36px]">{t("nav_users")}</Display>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder={t("searchUsers")}
          aria-label={t("searchUsers")}
          className={clayInput}
        />
        <button className="min-h-12 rounded-full bg-ink px-6 font-semibold text-white">{t("search")}</button>
      </form>
      <Panel className="flex flex-col p-0 md:p-0">
        {rows.length === 0 && <p className="p-4 text-muted-foreground">{t("nothing")}</p>}
        {rows.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3 last:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <Link href={`/u/${u.id}`} className="font-semibold hover:underline">
                {u.name ?? t("noProfile")}
              </Link>
              <span className="text-sm text-muted-foreground">
                TG {u.telegramId ?? "—"} · {u.phoneVerified ? t("phoneOk") : t("phoneNo")} ·{" "}
                {u.createdAt.toISOString().slice(0, 10)}
                {u.role !== "traveler" && ` · ${u.role}`}
              </span>
            </span>
            {u.status === "active" ? (
              u.role !== "admin" && (
                <AdminButton
                  op={{ op: "user.suspend", id: u.id }}
                  label={t("suspend")}
                  tone="danger"
                  confirm
                />
              )
            ) : (
              <>
                <span className="rounded-full bg-danger-soft px-2.5 py-1 text-sm text-danger">
                  {t(`status_${u.status}` as "status_suspended")}
                </span>
                {u.status === "suspended" && (
                  <AdminButton op={{ op: "user.restore", id: u.id }} label={t("restore")} />
                )}
              </>
            )}
          </div>
        ))}
      </Panel>
    </>
  );
}
