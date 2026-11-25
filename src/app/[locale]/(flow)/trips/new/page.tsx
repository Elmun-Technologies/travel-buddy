import { Suspense } from "react";
import { z } from "zod";
import { isClubOrganizer } from "@/modules/clubs/service";
import { PageLoading } from "@/components/page-loading";
import { PhoneGate } from "@/components/phone-gate";
import { COUNTRIES, countryName, todayISO } from "@/lib/catalog";
import { botUsername } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { CreateWizard, type Tile } from "./wizard";

export default function NewTripPage(props: PageProps<"/[locale]/trips/new">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewTrip {...props} />
    </Suspense>
  );
}

// App-CreateTrip: 3 steps, ~60 seconds. Age range, plan and rules come later with the group.
async function NewTrip({ params, searchParams }: PageProps<"/[locale]/trips/new">) {
  const locale = asLocale((await params).locale);
  const { user, profile } = await requireProfile(locale);
  if (!user.phoneVerified) return <PhoneGate bot={botUsername()} />;
  const sp = await searchParams;
  const pre = sp.country;
  // ?club=<id>: open the trip in a club's name (only if I organize that club)
  const clubParam = z.uuid().safeParse(sp.club);
  const clubId =
    clubParam.success && (await isClubOrganizer(user.id, clubParam.data)) ? clubParam.data : undefined;
  const name = (c: string) => countryName(c, locale);
  const tiles: Tile[] = [
    { country: "GE", label: name("GE"), photo: "gergeti" },
    { country: "TR", label: name("TR"), photo: "istanbul-galata" },
    { country: "KZ", label: name("KZ"), photo: "almaty" },
    {
      country: "AE",
      label: name("AE") === "Birlashgan Arab Amirliklari" ? "BAA" : name("AE"),
      photo: "dubai",
    },
    { country: "TR", city: "Kapadokya", label: "Kapadokya", photo: "cappadocia" },
    { country: "UZ", label: name("UZ"), photo: "samarkand" },
  ];
  return (
    <CreateWizard
      locale={locale}
      today={todayISO()}
      tiles={tiles}
      countries={COUNTRIES.map((c) => ({ value: c, label: name(c) }))}
      initialCountry={typeof pre === "string" && (COUNTRIES as readonly string[]).includes(pre) ? pre : null}
      styles={profile.travelStyles}
      canWomenOnly={profile.gender === "female"}
      bot={botUsername()}
      clubId={clubId}
    />
  );
}
