import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { TripForm } from "@/components/trips/trip-forms";
import { buttonVariants } from "@/components/ui/button";
import { countryOptions, todayISO } from "@/lib/catalog";
import { botUsername } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";

export default function NewTripPage(props: PageProps<"/[locale]/trips/new">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewTrip {...props} />
    </Suspense>
  );
}

async function NewTrip({ params }: PageProps<"/[locale]/trips/new">) {
  const locale = asLocale((await params).locale);
  const { user } = await requireProfile(locale);
  const [t, tp] = await Promise.all([getTranslations("trip"), getTranslations("profile")]);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-semibold tracking-tight">{t("newTitle")}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">{t("newSubtitle")}</p>
      {user.phoneVerified ? (
        <TripForm minDate={todayISO()} countries={countryOptions(locale)} />
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <p>{t("phoneRequired")}</p>
          {botUsername() && (
            <a
              href={`https://t.me/${botUsername()}?start=phone`}
              className={buttonVariants({ className: "h-10 self-start px-4" })}
            >
              {tp("phoneButton")}
            </a>
          )}
        </section>
      )}
    </div>
  );
}
