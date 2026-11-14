import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { redirect } from "@/i18n/navigation";
import { countryName, languageOptions, POPULAR_DESTINATIONS } from "@/lib/catalog";
import { botUsername } from "@/lib/format";
import { asLocale, requireUser } from "@/lib/guard";
import { getDraft, getOwnProfile } from "@/modules/profiles/service";
import { OnboardingWizard } from "./wizard";

export default function OnboardingPage(props: PageProps<"/[locale]/onboarding">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Onboarding {...props} />
    </Suspense>
  );
}

async function Onboarding({ params, searchParams }: PageProps<"/[locale]/onboarding">) {
  const locale = asLocale((await params).locale);
  const user = await requireUser(locale);
  if (await getOwnProfile(user.id)) redirect({ href: "/trips", locale });
  const name = (await searchParams).name;
  return (
    <OnboardingWizard
      draftKey={`tb:onboarding:${user.id}`}
      serverDraft={await getDraft(user.id)}
      phoneVerified={user.phoneVerified}
      bot={botUsername()}
      name={typeof name === "string" ? name.slice(0, 50) : ""}
      locale={locale}
      languages={languageOptions(locale).slice(0, 8)} // the rest: profile edit
      destinations={POPULAR_DESTINATIONS.map((c) => ({ value: c, label: countryName(c, locale) }))}
    />
  );
}
