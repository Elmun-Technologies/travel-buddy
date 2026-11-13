import { Suspense } from "react";
import { BadgeCheck, Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { ProfileCard } from "@/components/profile/profile-card";
import { TripCard } from "@/components/trips/trip-card";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/catalog";
import { botUsername, flag, formatDateRange } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { getPublicProfile } from "@/modules/profiles/service";
import { listMyIntents, listMyTrips } from "@/modules/trips/service";
import { closeIntentAction, logoutAction } from "../actions";

export default function MePage(props: PageProps<"/[locale]/me">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Me {...props} />
    </Suspense>
  );
}

async function Me({ params }: PageProps<"/[locale]/me">) {
  const locale = asLocale((await params).locale);
  const { user } = await requireProfile(locale);
  const [p, trips, intents, t, tt, tc, ta] = await Promise.all([
    getPublicProfile(user.id, user.id),
    listMyTrips(user.id),
    listMyIntents(user.id),
    getTranslations("profile"),
    getTranslations("trip"),
    getTranslations("common"),
    getTranslations("app"),
  ]);
  const bot = botUsername();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="sr-only">{t("title")}</h1>
        <Link href="/profile/edit" className={buttonVariants({ variant: "outline" })}>
          {tc("edit")}
        </Link>
        <form action={logoutAction}>
          <input type="hidden" name="locale" value={locale} />
          <button className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {ta("logout")}
          </button>
        </form>
      </div>

      {p && <ProfileCard p={p} />}

      {user.phoneVerified ? (
        <p className="flex items-center gap-2 text-sm text-primary">
          <BadgeCheck className="size-4" aria-hidden /> {t("phoneDone")}
        </p>
      ) : (
        <section className="flex flex-col gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Phone className="size-4" aria-hidden /> {t("phoneTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("phoneText")}</p>
          {bot && (
            <a
              href={`https://t.me/${bot}?start=phone`}
              className={buttonVariants({ className: "h-10 self-start px-4" })}
            >
              {t("phoneButton")}
            </a>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold">{t("myTrips")}</h2>
        {trips.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {trips.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                badge={
                  trip.myStatus.role === "organizer"
                    ? tt("organizer")
                    : trip.myStatus.status === "approved"
                      ? tt("approved")
                      : tt("pending")
                }
              />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">{t("noTrips")}</p>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{t("myIntents")}</h2>
          <Link href="/intents/new" className={buttonVariants({ variant: "outline", size: "sm" })}>
            + {t("addIntent")}
          </Link>
        </div>
        {intents.length ? (
          <ul className="flex flex-col gap-3">
            {intents.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border p-4">
                <span>
                  {flag(i.destinationCountry)} {countryName(i.destinationCountry, locale)}
                  {i.destinationCity && `, ${i.destinationCity}`}
                  <span className="text-muted-foreground">
                    {" "}
                    · {formatDateRange(i.startDate, i.endDate, locale)}
                  </span>
                </span>
                <form action={closeIntentAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="intentId" value={i.id} />
                  <button className="text-sm text-muted-foreground hover:text-foreground">
                    {tc("close")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">{t("noIntents")}</p>
        )}
      </section>
    </div>
  );
}
