import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { CheckIcon, Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { MainAction } from "@/components/telegram-actions";
import { JoinAction } from "@/components/trips/join-action";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { countryName, todayISO } from "@/lib/catalog";
import { formatBudget, formatDateRange } from "@/lib/format";
import { asLocale } from "@/lib/guard";
import { countryPhoto } from "@/lib/photos";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { joinDenied } from "@/modules/groups/rules";
import { getMyMembership, listMembers } from "@/modules/groups/service";
import { getJoinProfile, getPublicProfile } from "@/modules/profiles/service";
import { getTripView } from "@/modules/trips/service";
import { closeTripAction, decideAction, leaveAction } from "../../actions";

type Trip = NonNullable<Awaited<ReturnType<typeof getTripView>>>;
type Members = Awaited<ReturnType<typeof listMembers>>;

const label = "text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase";
const tag =
  "inline-flex items-center rounded-full border border-input bg-card px-2.5 py-1 text-xs font-medium";
const avatarTones = ["bg-[#cfdae6]", "bg-[#e8dccb]", "bg-[#d6e6d3]", "bg-[#ead3e0]", "bg-[#d3e8e6]"];

export default function TripPage(props: PageProps<"/[locale]/trips/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TripDetail {...props} />
    </Suspense>
  );
}

// App-TripDetail.png: photo, what & when, organizer, participants, plan, one main action.
async function TripDetail({ params }: PageProps<"/[locale]/trips/[id]">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const user = await getSessionUser();
  const tripId = z.uuid().safeParse(id);
  const trip = tripId.success ? await getTripView(tripId.data, user?.id ?? null) : null;
  const [t, ts] = await Promise.all([getTranslations("trip"), getTranslations("styles")]);
  if (!trip) return <p className="py-16 text-center text-muted-foreground">{t("notFound")}</p>;

  const [organizer, members] = await Promise.all([
    trip.ownerUserId ? getPublicProfile(user?.id ?? trip.ownerUserId, trip.ownerUserId) : null,
    user ? listMembers(user.id, trip.id) : null,
  ]);
  const budget = formatBudget(trip.budgetMin, trip.budgetMax, trip.currency);
  const left = trip.groupSizeMax ? Math.max(0, trip.groupSizeMax - trip.approvedCount) : null;
  const approved = members?.filter((m) => m.status === "approved") ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-2">
      <div className="relative h-[270px] overflow-hidden rounded-[22px] bg-[#b9c7d6]">
        {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP */}
        <img
          src={countryPhoto(trip.destinationCountry, 1200, trip.destinationCity)}
          alt={countryName(trip.destinationCountry, locale)}
          className="size-full object-cover"
          fetchPriority="high"
        />
        {trip.isTest && (
          <span className="absolute top-3 left-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold">
            {t("sample")}
          </span>
        )}
      </div>

      <Panel className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {countryName(trip.destinationCountry, locale)}
          {trip.destinationCity && ` · ${trip.destinationCity}`}
        </p>
        <Display className="text-[32px]">{trip.title}</Display>
        <p className="text-[15px]">
          {formatDateRange(trip.startDate, trip.endDate, locale)}
          {trip.dateFlexDays ? ` (${t("flex", { n: trip.dateFlexDays })})` : ""}
          {budget && <span className="text-muted-foreground"> · {budget}</span>}
        </p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {trip.womenOnly && (
            <span className={cn(tag, "border-ink bg-ink text-white")}>{t("womenOnlyBadge")}</span>
          )}
          {trip.travelStyles.map((s) => (
            <span key={s} className={tag}>
              {ts(s)}
            </span>
          ))}
          {(trip.ageMin || trip.ageMax) && (
            <span className={tag}>{t("ageRange", { min: trip.ageMin ?? 18, max: trip.ageMax ?? 99 })}</span>
          )}
          {trip.status !== "open" && <span className={tag}>{t(`status.${trip.status}`)}</span>}
        </div>
      </Panel>

      {organizer && (
        <Panel className="flex flex-col gap-3">
          <span className={label}>{t("organizer")}</span>
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "flex size-16 flex-none items-center justify-center rounded-full text-xl font-semibold",
                avatarTones[0],
              )}
            >
              {organizer.displayName.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold">
                {organizer.displayName} · {organizer.age}
              </div>
              <div className="flex flex-wrap gap-x-2 text-sm text-muted-foreground">
                {organizer.verified.telegram && <Check>Telegram</Check>}
                {organizer.verified.phone && <Check>{t("phoneOk")}</Check>}
                {organizer.verified.id && <Check>{t("idOk")}</Check>}
              </div>
            </div>
            {user && (
              <Link
                href={`/u/${organizer.userId}`}
                className="min-h-11 py-3 text-sm font-medium underline underline-offset-4"
              >
                {t("profileLink")}
              </Link>
            )}
          </div>
        </Panel>
      )}

      <Panel className="flex flex-col gap-3">
        <div className="flex justify-between gap-3">
          <span className={label}>
            {t("membersLabel")}
            {trip.groupSizeMax ? ` · ${trip.approvedCount}/${trip.groupSizeMax}` : ` · ${trip.approvedCount}`}
          </span>
          {left != null && (
            <span className="text-sm text-muted-foreground">{t("spotsLeft", { n: left })}</span>
          )}
        </div>
        <Avatars names={approved?.map((m) => m.name) ?? null} count={trip.approvedCount} />
        {!approved && <p className="text-[13px] text-muted-foreground">{t("membersNote")}</p>}
      </Panel>

      {trip.description && (
        <Panel className="flex flex-col gap-2">
          <span className={label}>{t("planLabel")}</span>
          <p className="whitespace-pre-line">{trip.description}</p>
        </Panel>
      )}

      <JoinArea
        trip={trip}
        user={user}
        locale={locale}
        members={members}
        organizer={organizer?.displayName ?? null}
      />
    </div>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <CheckIcon />
      {children}
    </span>
  );
}

/** Up to 5 member circles: initials for members (who may see each other), blank otherwise. */
function Avatars({ names, count }: { names: string[] | null; count: number }) {
  const shown = Math.min(count, 5);
  return (
    <div className="flex">
      {Array.from({ length: shown }, (_, i) => (
        <span
          key={i}
          className={cn(
            "-ml-2 flex size-11 items-center justify-center rounded-full border-2 border-card text-sm font-semibold first:ml-0",
            avatarTones[i % avatarTones.length],
          )}
        >
          {names?.[i]?.slice(0, 1) ?? ""}
        </span>
      ))}
      {count > shown && (
        <span className="-ml-2 flex size-11 items-center justify-center rounded-full border-2 border-card bg-background text-sm font-semibold">
          +{count - shown}
        </span>
      )}
    </div>
  );
}

async function JoinArea({
  trip,
  user,
  locale,
  members,
  organizer,
}: {
  trip: Trip;
  user: SessionUser | null;
  locale: Locale;
  members: Members;
  organizer: string | null;
}) {
  const t = await getTranslations("trip");
  const te = await getTranslations("errors");
  const hidden = (name: string, value: string) => <input type="hidden" name={name} value={value} />;
  const small = "min-h-11 self-start py-2.5 text-sm text-muted-foreground underline-offset-4 hover:underline";

  if (!user) return <MainAction label={t("loginToJoin")} href="/login" />;
  const [profile, membership] = await Promise.all([
    getJoinProfile(user.id),
    getMyMembership(user.id, trip.id),
  ]);
  if (!profile) return <MainAction label={t("profileToJoin")} href="/onboarding" />;

  if (trip.isOwner) {
    const requests = members?.filter((m) => m.status === "requested") ?? [];
    return (
      <Panel className="flex flex-col gap-3">
        <span className={label}>{t("requests")}</span>
        {requests.length === 0 && <p className="text-sm text-muted-foreground">{t("noRequests")}</p>}
        {requests.map((r) => (
          <div
            key={r.userId}
            className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0"
          >
            <Link href={`/u/${r.userId}`} className="font-semibold underline-offset-4 hover:underline">
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
                    className={cn(
                      "press min-h-11 rounded-full px-5 text-sm font-medium",
                      d === "approve" ? "bg-ink text-white" : "border border-input",
                    )}
                  >
                    {t(d)}
                  </button>
                </form>
              ))}
            </div>
          </div>
        ))}
        {(trip.status === "open" || trip.status === "full") && (
          <form action={closeTripAction}>
            {hidden("locale", locale)}
            {hidden("tripId", trip.id)}
            <button className={small}>{t("closeTrip")}</button>
          </form>
        )}
      </Panel>
    );
  }

  const leaveForm = (text: string) => (
    <form action={leaveAction}>
      {hidden("locale", locale)}
      {hidden("tripId", trip.id)}
      <button className={small}>{text}</button>
    </form>
  );

  if (membership?.status === "approved")
    return (
      <Panel tone="soft" className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{t("approved")}</p>
        <p className="text-sm">{t("chatSoon")}</p>
        {leaveForm(t("leave"))}
      </Panel>
    );
  if (membership?.status === "requested")
    return (
      <Panel tone="soft" className="flex flex-col gap-1">
        <p className="font-semibold">{t("requested", { name: organizer ?? "" })}</p>
        {leaveForm(t("cancelRequest"))}
      </Panel>
    );

  // Mirror server rules to explain why joining isn't possible (the API re-checks).
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
  if (denied)
    return (
      <Panel className="text-muted-foreground">
        <p>{te(denied)}</p>
      </Panel>
    );
  return <JoinAction tripId={trip.id} organizer={organizer} />;
}
