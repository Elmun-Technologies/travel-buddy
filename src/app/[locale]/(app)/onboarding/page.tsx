import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { countryOptions, languageOptions } from "@/lib/catalog";
import { ProfileForm } from "@/components/profile/profile-form";
import { redirect } from "@/i18n/navigation";
import { asLocale, requireUser } from "@/lib/guard";
import { getDraft, getOwnProfile } from "@/modules/profiles/service";

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
  const server = await getDraft(user.id);
  const t = await getTranslations("profile");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{t("onboardingTitle")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("onboardingSubtitle")}</p>
      <ProfileForm
        next="trips"
        draft={{ key: `tb:onboarding:${user.id}`, server }}
        countries={countryOptions(locale)}
        languages={languageOptions(locale)}
        initial={{
          displayName: typeof name === "string" ? name.slice(0, 50) : "",
          birthDate: "",
          gender: null,
          showGender: false,
          city: "",
          country: "UZ",
          languages: [locale],
          travelStyles: [],
          interests: [],
          bio: "",
        }}
      />
    </div>
  );
}
