import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { BackTo } from "@/components/telegram-actions";
import { asLocale, requireProfile } from "@/lib/guard";
import { reviewable } from "@/modules/reviews/service";
import { RateRow } from "./rate-row";

export default function ReviewsPage(props: PageProps<"/[locale]/trips/[id]/reviews">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Reviews {...props} />
    </Suspense>
  );
}

// After the trip: one tap per companion. Only the average is ever shown on a profile.
async function Reviews({ params }: PageProps<"/[locale]/trips/[id]/reviews">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const { user } = await requireProfile(locale);
  const tripId = z.uuid().safeParse(id);
  const data = tripId.success ? await reviewable(user.id, tripId.data) : null;
  if (!tripId.success || !data) notFound();
  const t = await getTranslations("reviews");
  return (
    <>
      <BackTo
        label={t("back")}
        href={`/trips/${tripId.data}`}
        className="min-h-11 self-start px-1 text-[15px] font-medium text-blue"
      />
      <Display className="px-1 pt-2 text-[36px]">{t("title")}</Display>
      <p className="px-1 text-[15px] text-muted-foreground">{t("lead")}</p>
      {data.people.length === 0 ? (
        <Panel className="text-[15px] text-muted-foreground">{t("empty")}</Panel>
      ) : (
        data.people.map((p) => <RateRow key={p.id} tripId={tripId.data} person={p} />)
      )}
    </>
  );
}
