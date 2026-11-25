import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { countryOptions, languageOptions } from "@/lib/catalog";
import { ProfileForm } from "@/components/profile/profile-form";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { asLocale, requireProfile } from "@/lib/guard";
import { storageEnabled } from "@/lib/storage";

export default function EditProfilePage(props: PageProps<"/[locale]/profile/edit">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <EditProfile {...props} />
    </Suspense>
  );
}

async function EditProfile({ params }: PageProps<"/[locale]/profile/edit">) {
  const locale = asLocale((await params).locale);
  const { user, profile: p } = await requireProfile(locale);
  const t = await getTranslations("profile");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-8 text-3xl font-semibold tracking-tight">{t("editTitle")}</h1>
      <AvatarUpload
        userId={user.id}
        name={p.displayName}
        version={p.avatarKey ? p.avatarKey.slice(8, 16) : null}
        enabled={storageEnabled()}
      />
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
