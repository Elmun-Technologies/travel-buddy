import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { IntentForm } from "@/components/trips/trip-forms";
import { countryOptions, todayISO } from "@/lib/catalog";
import { asLocale, requireProfile } from "@/lib/guard";

export default function NewIntentPage(props: PageProps<"/[locale]/intents/new">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewIntent {...props} />
    </Suspense>
  );
}

async function NewIntent({ params }: PageProps<"/[locale]/intents/new">) {
  const locale = asLocale((await params).locale);
  await requireProfile(locale);
  const t = await getTranslations("intent");
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("subtitle")}</p>
      <IntentForm minDate={todayISO()} countries={countryOptions(locale)} />
    </div>
  );
}
