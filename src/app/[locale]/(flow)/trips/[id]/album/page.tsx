import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Display } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { BackTo } from "@/components/telegram-actions";
import { asLocale, requireProfile } from "@/lib/guard";
import { storageEnabled } from "@/lib/storage";
import {
  albumAccess,
  consentState,
  listAlbum,
  MAX_PHOTOS_PER_PERSON,
  myStory,
} from "@/modules/memories/service";
import { Album } from "./album";

export default function AlbumPage(props: PageProps<"/[locale]/trips/[id]/album">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <AlbumView {...props} />
    </Suspense>
  );
}

// Photos and short stories of a trip, for the people who were in the group.
async function AlbumView({ params }: PageProps<"/[locale]/trips/[id]/album">) {
  const { locale: l, id } = await params;
  const { user } = await requireProfile(asLocale(l));
  const tripId = z.uuid().safeParse(id);
  const trip = tripId.success ? await albumAccess(user.id, tripId.data) : null;
  if (!tripId.success || !trip) notFound();
  const [t, data, story, consent] = await Promise.all([
    getTranslations("album"),
    listAlbum(user.id, tripId.data),
    myStory(user.id, tripId.data),
    consentState(user.id, tripId.data),
  ]);
  return (
    <>
      <BackTo
        label={t("back")}
        href={`/trips/${tripId.data}`}
        className="min-h-11 self-start px-1 text-[15px] font-medium text-blue"
      />
      <Display className="px-1 pt-2 text-[36px]">{t("title")}</Display>
      <p className="px-1 text-[15px] text-muted-foreground">
        {trip.title} · {t("lead")}
      </p>
      <Album
        tripId={tripId.data}
        me={user.id}
        isOwner={trip.owner === user.id}
        uploads={storageEnabled()}
        max={MAX_PHOTOS_PER_PERSON}
        photos={data.photos.map((p) => ({ id: p.id, userId: p.userId, name: p.name }))}
        stories={data.stories}
        myStory={story}
        consent={{
          ...consent,
          link: consent.code ? `${process.env.APP_URL ?? ""}/${l}/s/${consent.code}` : null,
        }}
      />
    </>
  );
}
