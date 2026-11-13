import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageLoading } from "@/components/page-loading";
import { ProfileCard } from "@/components/profile/profile-card";
import { asLocale, requireProfile } from "@/lib/guard";
import { getPublicProfile } from "@/modules/profiles/service";

export default function UserPage(props: PageProps<"/[locale]/u/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <PublicProfile {...props} />
    </Suspense>
  );
}

// Profiles are visible to logged-in travelers only (privacy).
async function PublicProfile({ params }: PageProps<"/[locale]/u/[id]">) {
  const { locale, id } = await params;
  const { user } = await requireProfile(asLocale(locale));
  const uid = z.uuid().safeParse(id);
  const p = uid.success ? await getPublicProfile(user.id, uid.data) : null;
  if (!p)
    return (
      <p className="py-16 text-center text-muted-foreground">
        {(await getTranslations("profile"))("notFound")}
      </p>
    );
  return (
    <div className="mx-auto max-w-2xl">
      <ProfileCard p={p} />
    </div>
  );
}
