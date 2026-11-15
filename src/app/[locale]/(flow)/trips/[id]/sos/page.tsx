import { Suspense } from "react";
import { z } from "zod";
import { PageLoading } from "@/components/page-loading";
import { redirect } from "@/i18n/navigation";
import { countryName } from "@/lib/catalog";
import { EMERGENCY } from "@/lib/emergency";
import { botUsername } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { getDisplayNames } from "@/modules/profiles/service";
import { getVisaRule } from "@/modules/destinations/service";
import { getSafety, isApprovedMember } from "@/modules/safety/service";
import { getTripView } from "@/modules/trips/service";
import { Sos } from "./sos";

export default function SosPage(props: PageProps<"/[locale]/trips/[id]/sos">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <SosLoader {...props} />
    </Suspense>
  );
}

// App-SOS: hold 3 s → the group and trusted contacts get the location; "Hammasi joyida"; local numbers.
async function SosLoader({ params }: PageProps<"/[locale]/trips/[id]/sos">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const { user } = await requireProfile(locale);
  const tripId = z.uuid().safeParse(id);
  const ok = tripId.success && (await isApprovedMember(user.id, tripId.data));
  const trip = ok ? await getTripView(tripId.data!, user.id) : null;
  if (!trip) return redirect({ href: tripId.success ? `/trips/${id}` : "/rooms", locale });
  const [safety, names, visa] = await Promise.all([
    getSafety(user.id, trip.id),
    getDisplayNames(trip.ownerUserId ? [trip.ownerUserId] : []),
    getVisaRule(trip.destinationCountry),
  ]);
  return (
    <Sos
      tripId={trip.id}
      title={trip.title}
      country={countryName(trip.destinationCountry, locale)}
      emergency={EMERGENCY[trip.destinationCountry] ?? null}
      embassy={visa?.embassyPhone ? { phone: visa.embassyPhone, url: visa.embassyUrl } : null}
      organizer={
        trip.ownerUserId && trip.ownerUserId !== user.id ? (names.get(trip.ownerUserId) ?? null) : null
      }
      bot={botUsername()}
      {...safety}
    />
  );
}
