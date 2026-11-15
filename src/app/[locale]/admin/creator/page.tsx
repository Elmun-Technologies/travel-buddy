import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { ExternalLink } from "@/components/external-link";
import { Link } from "@/i18n/navigation";
import { requireAdmin } from "@/lib/guard";
import { listCreatorEntries } from "@/modules/admin/service";
import { CreatorForm } from "../ui";

// 1M Safar: entries, Reel links and the hand-entered views until the Instagram API is connected.
export default async function AdminCreator() {
  await requireAdmin();
  const [rows, t, tc] = await Promise.all([
    listCreatorEntries(),
    getTranslations("admin"),
    getTranslations("creator"),
  ]);
  return (
    <>
      <Display className="text-[36px]">{t("nav_creator")}</Display>
      <Panel tone="soft" className="text-[15px]">
        {t("creatorNote")}
      </Panel>
      {rows.length === 0 && <Panel className="text-muted-foreground">{t("noCreator")}</Panel>}
      {rows.map((r) => (
        <Panel key={r.id} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              <b>{r.name ?? "—"}</b>{" "}
              {r.instagram && <span className="text-muted-foreground">{r.instagram}</span>}
              {" · "}
              <Link href={`/trips/${r.tripId}`} className="hover:underline">
                {r.title}
              </Link>
            </span>
            <span className="rounded-full bg-background px-3 py-1 text-sm font-semibold">
              {tc(`st_${r.status}` as "st_joined")}
            </span>
          </div>
          {r.reelUrl && (
            <span className="text-[15px]">
              <ExternalLink href={r.reelUrl} className="text-blue underline">
                {t("openReel")}
              </ExternalLink>
              {r.postedAt && <span className="text-muted-foreground"> · {r.postedAt}</span>}
            </span>
          )}
          <CreatorForm id={r.id} status={r.status} views={r.views} note={r.note} />
        </Panel>
      ))}
    </>
  );
}
