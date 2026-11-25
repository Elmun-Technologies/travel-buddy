import { Suspense } from "react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageLoading } from "@/components/page-loading";
import { countryOptions, todayISO } from "@/lib/catalog";
import { asLocale, requireProfile } from "@/lib/guard";
import { getOfferForEdit } from "@/modules/agencies/service";
import { OfferForm } from "../offer-form";

export default function EditOfferPage(props: PageProps<"/[locale]/agency/offers/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditOffer {...props} />
    </Suspense>
  );
}

async function EditOffer({ params }: PageProps<"/[locale]/agency/offers/[id]">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const { user } = await requireProfile(locale);
  const tripId = z.uuid().safeParse(id);
  const row = tripId.success ? await getOfferForEdit(user.id, tripId.data) : null;
  if (!tripId.success || !row) notFound();
  const { trip, offer } = row;
  const itinerary = (offer.itinerary as { title: string; text: string }[])
    .map((d) => (d.text ? `${d.title}: ${d.text}` : d.title))
    .join("\n");
  return (
    <OfferForm
      tripId={tripId.data}
      today={todayISO()}
      countries={countryOptions(locale)}
      initial={{
        title: trip.title,
        destinationCountry: trip.destinationCountry,
        destinationCity: trip.destinationCity ?? "",
        startDate: trip.startDate,
        endDate: trip.endDate,
        price: String(Math.round(offer.price / 100)),
        seats: String(offer.seatsTotal),
        includes: offer.includes.join("\n"),
        excludes: offer.excludes.join("\n"),
        itinerary,
        refundPolicy: offer.refundPolicy ?? "",
        description: trip.description ?? "",
        travelStyles: trip.travelStyles,
      }}
    />
  );
}
