import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { Link } from "@/i18n/navigation";
import { formatTripDates } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { listMyMemories } from "@/modules/memories/service";

export default function MemoriesPage(props: PageProps<"/[locale]/memories">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Memories {...props} />
    </Suspense>
  );
}

// Trips that have started: album, stories and ratings in one place.
async function Memories({ params }: PageProps<"/[locale]/memories">) {
  const locale = asLocale((await params).locale);
  const { user } = await requireProfile(locale);
  const [t, list] = await Promise.all([getTranslations("memories"), listMyMemories(user.id)]);
  if (!list.length)
    return <EmptyState title={t("title")} text={t("soon")} action={t("action")} href="/trips" />;
  return (
    <div className="flex flex-col gap-2">
      <Display className="px-1 py-2 text-[32px]">{t("listTitle")}</Display>
      {list.map((m) => (
        <Panel key={m.id} className="flex flex-col gap-2">
          <div className="text-lg font-semibold">{m.title}</div>
          <div className="text-sm text-muted-foreground">
            {formatTripDates({ startDate: m.start, endDate: m.end, datePrecision: "exact" }, locale)} ·{" "}
            {t("photos", { n: m.photos })}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/trips/${m.id}/album`}
              className="press inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-white"
            >
              {t("openAlbum")}
            </Link>
            {m.status === "completed" && (
              <Link
                href={`/trips/${m.id}/reviews`}
                className="press inline-flex min-h-11 items-center rounded-full border border-input px-5 text-sm font-medium"
              >
                {t("rate")}
              </Link>
            )}
          </div>
        </Panel>
      ))}
    </div>
  );
}
