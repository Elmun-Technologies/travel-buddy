import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageLoading } from "@/components/page-loading";
import { todayISO } from "@/lib/catalog";
import { asLocale, requireProfile } from "@/lib/guard";
import { getTripView } from "@/modules/trips/service";
import { EditTripForm } from "./form";

export default function EditTripPage(props: PageProps<"/[locale]/trips/[id]/edit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Edit {...props} />
    </Suspense>
  );
}

// The organizer fixes dates, size, budget and the note after publishing. Not where it goes.
async function Edit({ params }: PageProps<"/[locale]/trips/[id]/edit">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const { user, profile } = await requireProfile(locale);
  const tripId = z.uuid().safeParse(id);
  const trip = tripId.success ? await getTripView(tripId.data, user.id) : null;
  if (!trip?.isOwner) notFound();
  const t = await getTranslations("create");
  if (!["open", "full", "closed"].includes(trip.status) || trip.startDate <= todayISO())
    return <p className="py-16 text-center text-muted-foreground">{t("notEditable")}</p>;

  const band =
    trip.budgetMin == null && trip.budgetMax === 30000
      ? "lt300"
      : trip.budgetMin === 30000 && trip.budgetMax === 60000
        ? "300_600"
        : trip.budgetMin === 60000 && trip.budgetMax === 100000
          ? "600_1000"
          : "any";
  return (
    <EditTripForm
      tripId={trip.id}
      locale={locale}
      today={todayISO()}
      title={trip.title}
      initial={{
        start: trip.startDate,
        end: trip.endDate,
        flex: trip.dateFlexDays > 0,
        size: trip.groupSizeMax ?? 6,
        band,
        styles: trip.travelStyles,
        womenOnly: trip.womenOnly,
        note: trip.description ?? "",
      }}
      minSize={Math.max(3, trip.approvedCount)}
      canWomenOnly={profile.gender === "female" && trip.approvedCount <= 1}
      womenOnlyOn={trip.womenOnly}
    />
  );
}
