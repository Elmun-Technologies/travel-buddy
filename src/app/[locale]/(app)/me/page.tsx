import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Panel } from "@/components/clay";
import { ExternalLink } from "@/components/external-link";
import { LocaleSwitch } from "@/components/locale-switch";
import { SoundSwitch } from "@/components/sound";
import { NotifySettings } from "@/components/profile/notify-settings";
import { PageLoading } from "@/components/page-loading";
import { ProfileCard, profileChip } from "@/components/profile/profile-card";
import { TripCard } from "@/components/trips/trip-card";
import { Link } from "@/i18n/navigation";
import { type Country, countryName } from "@/lib/catalog";
import { botUsername, formatDateRange } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { getPublicProfile } from "@/modules/profiles/service";
import { listMyIntents, listMyTrips } from "@/modules/trips/service";
import { getNotifyOff } from "@/modules/users/service";
import { closeIntentAction, logoutAction } from "../actions";

export default function MePage(props: PageProps<"/[locale]/me">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Me {...props} />
    </Suspense>
  );
}

const label = "text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase";
const tag = "inline-flex min-h-9 items-center rounded-full border border-input px-3 text-[13px] font-medium";
const row = "flex min-h-14 items-center justify-between gap-3 border-b border-line py-3 last:border-b-0";

// App-Profile.png. Real numbers only: trips and countries from memberships; rating once reviews exist.
async function Me({ params }: PageProps<"/[locale]/me">) {
  const locale = asLocale((await params).locale);
  const { user, profile } = await requireProfile(locale);
  const [p, trips, intents, notifyOff, t, tt, tc, ta, ts] = await Promise.all([
    getPublicProfile(user.id, user.id),
    listMyTrips(user.id),
    listMyIntents(user.id),
    getNotifyOff(user.id),
    getTranslations("profile"),
    getTranslations("trip"),
    getTranslations("common"),
    getTranslations("app"),
    getTranslations("styles"),
  ]);
  const bot = botUsername();
  const joined = trips.filter((x) => x.myStatus.status === "approved");
  const countries = new Set(joined.map((x) => x.destinationCountry));

  return (
    <div className="flex flex-col gap-2">
      <h1 className="sr-only">{t("title")}</h1>
      {p && (
        <ProfileCard
          p={p}
          actions={
            <>
              {!user.phoneVerified && bot && (
                <ExternalLink
                  href={`https://t.me/${bot}?start=phone`}
                  className={`${profileChip} border-ink`}
                >
                  {t("phoneButton")}
                </ExternalLink>
              )}
              <Link href="/profile/edit" className={`${profileChip} border-input`}>
                {t("editTitle")}
              </Link>
            </>
          }
        />
      )}

      <div className="grid grid-cols-3 gap-2">
        <Stat n={String(joined.length)} label={t("statTrips")} />
        <Stat n={String(countries.size)} label={t("statCountries")} />
        <Stat n="—" label={t("statRating")} tone="signal" />
      </div>

      <Panel className="flex flex-col gap-3">
        <span className={label}>{t("travelStyles")}</span>
        <div className="flex flex-wrap gap-1.5">
          {profile.travelStyles.length ? (
            profile.travelStyles.map((s) => (
              <span key={s} className={tag}>
                {ts(s)}
              </span>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
        {profile.dreamDestinations.length > 0 && (
          <>
            <span className={`${label} mt-2`}>{t("dreams")}</span>
            <div className="flex flex-wrap gap-1.5">
              {(profile.dreamDestinations as Country[]).map((c) => (
                <span key={c} className={tag}>
                  {countryName(c, locale)}
                </span>
              ))}
            </div>
          </>
        )}
      </Panel>

      <section className="flex flex-col gap-2 pt-2">
        <h2 className="px-1 text-[15px] font-semibold">{t("myTrips")}</h2>
        {trips.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
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
          <Panel className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("noTrips")}</span>
            <Link href="/trips" className="min-h-11 py-3 text-sm font-medium text-blue">
              {t("findTrips")}
            </Link>
          </Panel>
        )}
      </section>

      <Panel className="flex flex-col">
        <div className={row}>
          <span className="font-medium">{t("myIntents")}</span>
          <Link href="/intents/new" className="min-h-11 py-3 text-sm font-medium text-blue">
            + {t("addIntent")}
          </Link>
        </div>
        {intents.map((i) => (
          <div key={i.id} className={row}>
            <span className="text-sm">
              {countryName(i.destinationCountry, locale)}
              {i.destinationCity && `, ${i.destinationCity}`}
              <span className="text-muted-foreground">
                {" "}
                · {formatDateRange(i.startDate, i.endDate, locale)}
              </span>
            </span>
            <form action={closeIntentAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="intentId" value={i.id} />
              <button className="min-h-11 text-sm text-muted-foreground hover:text-foreground">
                {tc("close")}
              </button>
            </form>
          </div>
        ))}
        <div className={row}>
          <span className="font-medium">{t("language")}</span>
          <LocaleSwitch />
        </div>
        {user.role === "admin" && (
          <div className={row}>
            <Link href="/admin" className="min-h-11 py-3 font-medium text-blue">
              {ta("adminPanel")}
            </Link>
          </div>
        )}
        <div className={row}>
          <span id="sound-label" className="font-medium">
            {t("sounds")}
          </span>
          <SoundSwitch />
        </div>
        <div className={row}>
          <form action={logoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button className="min-h-11 text-[15px] font-medium text-danger">{ta("logout")}</button>
          </form>
        </div>
      </Panel>
      <NotifySettings initialOff={notifyOff} />
    </div>
  );
}

function Stat({ n, label, tone }: { n: string; label: string; tone?: "signal" }) {
  return (
    <div
      className={`flex min-h-[120px] flex-col justify-between rounded-[22px] p-4 ${tone ? "bg-signal" : "bg-card"}`}
    >
      <span className="font-display text-[44px]">{n}</span>
      <span className="text-[13px] text-muted-foreground">{label}</span>
    </div>
  );
}
