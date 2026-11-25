import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Display } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { BackTo } from "@/components/telegram-actions";
import { botUsername } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { groupStatus } from "@/modules/telegram-group/service";
import { GroupPanel } from "./panel";

export default function TelegramGroupPage(props: PageProps<"/[locale]/trips/[id]/telegram">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <View {...props} />
    </Suspense>
  );
}

async function View({ params }: PageProps<"/[locale]/trips/[id]/telegram">) {
  const { locale: l, id } = await params;
  const { user } = await requireProfile(asLocale(l));
  const tripId = z.uuid().safeParse(id);
  const st = tripId.success ? await groupStatus(user.id, tripId.data) : null;
  if (!tripId.success || !st) notFound();
  const t = await getTranslations("tgGroup");
  return (
    <>
      <BackTo
        label={t("back")}
        href={`/trips/${tripId.data}`}
        className="min-h-11 self-start px-1 text-[15px] font-medium text-blue"
      />
      <Display className="px-1 pt-2 text-[34px]">{t("title")}</Display>
      <p className="px-1 text-[15px] text-muted-foreground">{t("lead")}</p>
      <GroupPanel tripId={tripId.data} status={st} bot={botUsername()} />
    </>
  );
}
