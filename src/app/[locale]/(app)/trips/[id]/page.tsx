import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { PageLoading } from "@/components/page-loading";
import { JoinForm } from "@/components/trips/join-form";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { countryName, todayISO } from "@/lib/catalog";
import { flag, formatBudget, formatDateRange } from "@/lib/format";
import { asLocale } from "@/lib/guard";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { joinDenied } from "@/modules/groups/rules";
import { getMyMembership, listMembers } from "@/modules/groups/service";
import { getJoinProfile } from "@/modules/profiles/service";
import { getTripView } from "@/modules/trips/service";
import { closeTripAction, decideAction, leaveAction } from "../../actions";

type Trip = NonNullable<Awaited<ReturnType<typeof getTripView>>>;

export default function TripPage(props: PageProps<"/[locale]/trips/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TripDetail {...props} />
    </Suspense>
  );
}

async function TripDetail({ params }: PageProps<"/[locale]/trips/[id]">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const user = await getSessionUser();
  const tripId = z.uuid().safeParse(id);
  const trip = tripId.success ? await getTripView(tripId.data, user?.id ?? null) : null;
  const [t, ts, ta] = await Promise.all([
    getTranslations("trip"),
    getTranslations("styles"),
    getTranslations("accommodation"),
  ]);
  if (!trip) return <p className="py-16 text-center text-muted-foreground">{t("notFound")}</p>;

  const budget = formatBudget(trip.budgetMin, trip.budgetMax, trip.currency, locale);
  const facts: [string, string | null][] = [
    [
      t("startDate"),
      `${formatDateRange(trip.startDate, trip.endDate, locale)}${trip.dateFlexDays ? ` (${t("flex", { n: trip.dateFlexDays })})` : ""}`,
    ],
    [t("budget"), budget],
    [
      t("groupSizeMax"),
      trip.groupSizeMax ? t("spots", { n: trip.approvedCount, max: trip.groupSizeMax }) : null,
    ],
    [t("age"), trip.ageMin || trip.ageMax ? `${trip.ageMin ?? 18}–${trip.ageMax ?? "99"}` : null],
    [t("accommodationPref"), trip.accommodationPref ? ta(trip.accommodationPref) : null],
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <article className="flex flex-col gap-6">
        <div>
          <p className="text-muted-foreground">
            {flag(trip.destinationCountry)} {countryName(trip.destinationCountry, locale)}
            {trip.destinationCity && `, ${trip.destinationCity}`}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-balance">{trip.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-muted px-3 py-1">{t(`status.${trip.status}`)}</span>
            {trip.womenOnly && (
              <span className="rounded-full bg-pink-100 px-3 py-1 text-pink-800">{t("womenOnlyBadge")}</span>
            )}
            {trip.travelStyles.map((s) => (
              <span key={s} className="rounded-full border px-3 py-1">
                {ts(s)}
              </span>
            ))}
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-3 rounded-2xl border p-5 sm:grid-cols-2">
          {facts
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
        </dl>
        {trip.description && <p className="whitespace-pre-line">{trip.description}</p>}
        {trip.ownerName && (
          <p className="text-sm text-muted-foreground">
            {t("organizer")}:{" "}
            {user ? (
              <Link
                href={`/u/${trip.ownerUserId}`}
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {trip.ownerName}
              </Link>
            ) : (
              <span className="font-medium text-foreground">{trip.ownerName}</span>
            )}
          </p>
        )}
      </article>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <JoinPanel trip={trip} user={user} locale={locale} />
      </aside>
    </div>
  );
}

async function JoinPanel({ trip, user, locale }: { trip: Trip; user: SessionUser | null; locale: Locale }) {
  const t = await getTranslations("trip");
  const te = await getTranslations("errors");
  const box = "flex flex-col gap-3 rounded-2xl border p-5";
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;

  if (!user)
    return (
      <div className={box}>
        <Link href="/login" className={buttonVariants({ className: "h-11" })}>
          {t("loginToJoin")}
        </Link>
      </div>
    );

  const [profile, membership, members] = await Promise.all([
    getJoinProfile(user.id),
    getMyMembership(user.id, trip.id),
    listMembers(user.id, trip.id),
  ]);
  if (!profile)
    return (
      <div className={box}>
        <Link href="/onboarding" className={buttonVariants({ className: "h-11" })}>
          {t("profileToJoin")}
        </Link>
      </div>
    );

  const memberList = members && (
    <div className={box}>
      <h2 className="font-semibold">{t("members")}</h2>
      <ul className="flex flex-col gap-2">
        {members
          .filter((m) => m.status === "approved")
          .map((m) => (
            <li key={m.userId}>
              <Link href={`/u/${m.userId}`} className="underline-offset-4 hover:underline">
                {m.name}
              </Link>
              {m.role === "organizer" && (
                <span className="text-sm text-muted-foreground"> · {t("organizer")}</span>
              )}
            </li>
          ))}
      </ul>
      <p className="text-sm text-muted-foreground">{t("chatSoon")}</p>
    </div>
  );

  if (trip.isOwner) {
    const requests = members?.filter((m) => m.status === "requested") ?? [];
    return (
      <>
        <div className={box}>
          <h2 className="font-semibold">{t("requests")}</h2>
          {requests.length === 0 && <p className="text-sm text-muted-foreground">{t("noRequests")}</p>}
          {requests.map((r) => (
            <div key={r.userId} className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
              <Link href={`/u/${r.userId}`} className="font-medium underline-offset-4 hover:underline">
                {r.name}
              </Link>
              {r.message && <p className="text-sm whitespace-pre-line text-muted-foreground">{r.message}</p>}
              <div className="flex gap-2">
                {(["approve", "reject"] as const).map((d) => (
                  <form key={d} action={decideAction}>
                    {hidden("locale", locale)}
                    {hidden("tripId", trip.id)}
                    {hidden("userId", r.userId)}
                    {hidden("decision", d)}
                    <button
                      className={buttonVariants({
                        size: "sm",
                        variant: d === "approve" ? "default" : "outline",
                      })}
                    >
                      {t(d)}
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ))}
        </div>
        {memberList}
        {(trip.status === "open" || trip.status === "full") && (
          <form action={closeTripAction}>
            {hidden("locale", locale)}
            {hidden("tripId", trip.id)}
            <button className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              {t("closeTrip")}
            </button>
          </form>
        )}
      </>
    );
  }

  const leaveForm = (label: string) => (
    <form action={leaveAction}>
      {hidden("locale", locale)}
      {hidden("tripId", trip.id)}
      <button className="text-sm text-muted-foreground underline-offset-4 hover:underline">{label}</button>
    </form>
  );

  if (membership?.status === "approved")
    return (
      <>
        <div className={box}>
          <p className="font-medium text-primary">{t("approved")}</p>
          {leaveForm(t("leave"))}
        </div>
        {memberList}
      </>
    );
  if (membership?.status === "requested")
    return (
      <div className={box}>
        <p>{t("requested")}</p>
        {leaveForm(t("cancelRequest"))}
      </div>
    );

  // Mirror server rules to explain why joining isn't possible (server re-checks on submit).
  const denied = joinDenied(
    { ...trip, approvedCount: trip.approvedCount },
    {
      id: user.id,
      ...profile,
      phoneVerified: user.phoneVerified,
      memberStatus: membership?.status ?? null,
      blocked: false,
    },
    todayISO(),
  );
  return (
    <div className={box}>
      {denied ? <p className="text-muted-foreground">{te(denied)}</p> : <JoinForm tripId={trip.id} />}
    </div>
  );
}
