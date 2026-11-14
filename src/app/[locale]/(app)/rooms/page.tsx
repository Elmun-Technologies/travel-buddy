import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Display } from "@/components/clay";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { TripCard } from "@/components/trips/trip-card";
import { asLocale, requireProfile } from "@/lib/guard";
import { listMyTrips } from "@/modules/trips/service";

export default function RoomsPage(props: PageProps<"/[locale]/rooms">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Rooms {...props} />
    </Suspense>
  );
}

// Trip rooms = groups you are in. The room itself (chat, plan, costs) comes in phase 5.
async function Rooms({ params }: PageProps<"/[locale]/rooms">) {
  const { user } = await requireProfile(asLocale((await params).locale));
  const [mine, t] = await Promise.all([listMyTrips(user.id), getTranslations("rooms")]);
  const rooms = mine.filter((m) => m.myStatus.status === "approved");
  if (!rooms.length)
    return <EmptyState title={t("title")} text={t("empty")} action={t("find")} href="/trips" />;
  return (
    <div className="flex flex-col gap-2">
      <Display className="px-1 py-2 text-[32px]">{t("title")}</Display>
      <div className="grid gap-2 sm:grid-cols-2">
        {rooms.map((trip) => (
          <TripCard key={trip.id} trip={trip} href={`/trips/${trip.id}/room`} />
        ))}
      </div>
    </div>
  );
}
