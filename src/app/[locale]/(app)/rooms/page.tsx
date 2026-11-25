import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { Avatar } from "@/components/avatar";
import { EmptyState } from "@/components/empty-state";
import { PageLoading } from "@/components/page-loading";
import { TripCard } from "@/components/trips/trip-card";
import { Link } from "@/i18n/navigation";
import { asLocale, requireProfile } from "@/lib/guard";
import { listDirect } from "@/modules/chat/service";
import { listMyTrips } from "@/modules/trips/service";

export default function RoomsPage(props: PageProps<"/[locale]/rooms">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Rooms {...props} />
    </Suspense>
  );
}

// Group rooms (trips you are in) and private conversations.
async function Rooms({ params }: PageProps<"/[locale]/rooms">) {
  const { user } = await requireProfile(asLocale((await params).locale));
  const [mine, chats, t, tc] = await Promise.all([
    listMyTrips(user.id),
    listDirect(user.id),
    getTranslations("rooms"),
    getTranslations("chats"),
  ]);
  const rooms = mine.filter((m) => m.myStatus.status === "approved");
  if (!rooms.length && !chats.length)
    return <EmptyState title={t("title")} text={t("empty")} action={t("find")} href="/trips" />;
  return (
    <div className="flex flex-col gap-2">
      <Display className="px-1 py-2 text-[32px]">{t("title")}</Display>
      <div className="grid gap-2 sm:grid-cols-2">
        {rooms.map((trip) => (
          <TripCard key={trip.id} trip={trip} href={`/trips/${trip.id}/room`} />
        ))}
      </div>
      {chats.length > 0 && (
        <>
          <h2 className="px-1 pt-4 text-lg font-semibold">{tc("title")}</h2>
          <Panel className="flex flex-col p-0 md:p-0">
            {chats.map((c) => (
              <Link
                key={c.id}
                href={`/chats/${c.id}`}
                className="flex min-h-16 items-center gap-3 border-b border-line px-4 py-3 last:border-0"
              >
                <Avatar userId={c.otherId} name={c.name} className="size-11 text-lg" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-semibold">
                    {c.name}
                    {c.kind === "lead" && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{tc("lead")}</span>
                    )}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">{c.preview || "·"}</span>
                </span>
                {c.unread && (
                  <span className="rounded-full bg-signal px-2.5 py-0.5 text-xs font-semibold text-ink">
                    {tc("unread")}
                  </span>
                )}
              </Link>
            ))}
          </Panel>
        </>
      )}
    </div>
  );
}
