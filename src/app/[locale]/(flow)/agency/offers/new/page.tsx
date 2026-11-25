import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageLoading } from "@/components/page-loading";
import { countryOptions, todayISO } from "@/lib/catalog";
import { asLocale, requireProfile } from "@/lib/guard";
import { agencyOf } from "@/modules/agencies/service";
import { OfferForm } from "../offer-form";

export default function NewOfferPage(props: PageProps<"/[locale]/agency/offers/new">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewOffer {...props} />
    </Suspense>
  );
}

async function NewOffer({ params }: PageProps<"/[locale]/agency/offers/new">) {
  const locale = asLocale((await params).locale);
  const { user } = await requireProfile(locale);
  const a = await agencyOf(user.id);
  if (a?.agency.status !== "verified") notFound();
  return (
    <OfferForm
      today={todayISO()}
      countries={countryOptions(locale)}
      initial={{
        title: "",
        destinationCountry: "GE",
        destinationCity: "",
        startDate: "",
        endDate: "",
        price: "",
        seats: "10",
        includes: "",
        excludes: "",
        itinerary: "",
        refundPolicy: "",
        description: "",
        travelStyles: [],
      }}
    />
  );
}
