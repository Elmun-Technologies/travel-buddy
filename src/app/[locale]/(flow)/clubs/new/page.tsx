import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PhoneGate } from "@/components/phone-gate";
import { botUsername } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { NewClubForm } from "./form";

export default function NewClubPage(props: PageProps<"/[locale]/clubs/new">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewClub {...props} />
    </Suspense>
  );
}

async function NewClub({ params }: PageProps<"/[locale]/clubs/new">) {
  const { user } = await requireProfile(asLocale((await params).locale));
  if (!user.phoneVerified) return <PhoneGate bot={botUsername()} />;
  return <NewClubForm />;
}
