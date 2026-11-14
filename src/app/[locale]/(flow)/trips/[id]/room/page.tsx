import { Suspense } from "react";
import { z } from "zod";
import { PageLoading } from "@/components/page-loading";
import { redirect } from "@/i18n/navigation";
import { asLocale, requireProfile } from "@/lib/guard";
import { flightSearchUrl } from "@/lib/aviasales";
import { countryName, todayISO } from "@/lib/catalog";
import { countryPhoto } from "@/lib/photos";
import { formatDay } from "@/lib/format";
import { shareLinks } from "@/lib/trip-share";
import { getPolls, getRoom, listMessages } from "@/modules/chat/service";
import { getTripView } from "@/modules/trips/service";
import { Room } from "./room";

export default function RoomPage(props: PageProps<"/[locale]/trips/[id]/room">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RoomLoader {...props} />
    </Suspense>
  );
}

// App-Room-Chat: the group's own space. Members only; everyone else goes back to the trip page.
async function RoomLoader({ params }: PageProps<"/[locale]/trips/[id]/room">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const { user } = await requireProfile(locale);
  const tripId = z.uuid().safeParse(id);
  const room = tripId.success ? await getRoom(user.id, tripId.data) : null;
  const trip = room ? await getTripView(tripId.data!, user.id) : null;
  if (!room || !trip) return redirect({ href: tripId.success ? `/trips/${id}` : "/rooms", locale });

  const initial = await listMessages(room.id, user.id);
  const polls = await getPolls(
    room.id,
    initial.flatMap((m) => (m.pollId ? [m.pollId] : [])),
    user.id,
  );
  return (
    <Room
      tripId={trip.id}
      title={trip.title}
      me={user.id}
      organizerId={trip.ownerUserId}
      isOwner={trip.isOwner}
      pinned={room.pinnedText}
      initial={initial}
      polls={polls}
      spots={trip.groupSizeMax ? { n: trip.approvedCount, max: trip.groupSizeMax } : null}
      share={
        trip.publicCode
          ? { tripId: trip.id, title: trip.title, ...shareLinks(trip.publicCode, locale) }
          : null
      }
      board={{
        destination: trip.destinationCity || countryName(trip.destinationCountry, locale),
        startDate: trip.startDate,
        startLabel: formatDay(trip.startDate, locale),
        deadlineLabel: trip.ticketDeadline ? formatDay(trip.ticketDeadline, locale) : null,
        today: todayISO(),
        deadline: trip.ticketDeadline,
        flightUrl: flightSearchUrl(trip),
        photo: countryPhoto(trip.destinationCountry, 400, trip.destinationCity),
        currency: trip.currency,
      }}
    />
  );
}
