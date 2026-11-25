import { Suspense } from "react";
import { PageLoading } from "@/components/page-loading";
import { PhoneGate } from "@/components/phone-gate";
import { botUsername } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { RegisterForm } from "./form";

export default function RegisterAgencyPage(props: PageProps<"/[locale]/agency/register">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Register {...props} />
    </Suspense>
  );
}

async function Register({ params }: PageProps<"/[locale]/agency/register">) {
  const { user } = await requireProfile(asLocale((await params).locale));
  if (!user.phoneVerified) return <PhoneGate bot={botUsername()} />;
  return <RegisterForm />;
}
