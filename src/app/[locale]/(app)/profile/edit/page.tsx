import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { countryOptions, languageOptions } from "@/lib/catalog";
import { ProfileForm } from "@/components/profile/profile-form";
import { asLocale, requireProfile } from "@/lib/guard";

export default function EditProfilePage(props: PageProps<"/[locale]/profile/edit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditProfile {...props} />
    </Suspense>
  );
}

async function EditProfile({ params }: PageProps<"/[locale]/profile/edit">) {
  const locale = asLocale((await params).locale);
  const { profile: p } = await requireProfile(locale);
  const t = await getTranslations("profile");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{t("editTitle")}</h1>
      <ProfileForm
        next="me"
        countries={countryOptions(locale)}
        languages={languageOptions(locale)}
        initial={{
          displayName: p.displayName,
          birthDate: p.birthDate,
          gender: p.gender,
          showGender: p.showGender,
          city: p.city ?? "",
          country: p.country,
          languages: p.languages,
          travelStyles: p.travelStyles,
          interests: p.interests,
          bio: p.bio ?? "",
        }}
      />
    </div>
  );
}
