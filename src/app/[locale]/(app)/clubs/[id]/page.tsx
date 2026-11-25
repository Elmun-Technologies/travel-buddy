import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { Link } from "@/i18n/navigation";
import { formatTripDates } from "@/lib/format";
import { asLocale, requireProfile } from "@/lib/guard";
import { getClub } from "@/modules/clubs/service";
import { ClubActions, Composer, PostDelete, RequestButtons } from "./actions";

export default function ClubPage(props: PageProps<"/[locale]/clubs/[id]">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Club {...props} />
    </Suspense>
  );
}

const label = "text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase";

async function Club({ params }: PageProps<"/[locale]/clubs/[id]">) {
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const { user } = await requireProfile(locale);
  const clubId = z.uuid().safeParse(id);
  const [t, c] = await Promise.all([
    getTranslations("clubsUi"),
    clubId.success ? getClub(user.id, clubId.data) : null,
  ]);
  if (!c) notFound();
  return (
    <div className="flex flex-col gap-2">
      <Link href="/clubs" className="min-h-11 self-start px-1 py-3 text-[15px] font-medium text-blue">
        {t("back")}
      </Link>
      <Panel tone="dark" className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-white/30 px-2.5 py-0.5">
            {c.privacy === "open" ? t("open") : t("closed")}
          </span>
          {c.city && <span className="rounded-full border border-white/30 px-2.5 py-0.5">{c.city}</span>}
        </div>
        <Display className="text-[34px]">{c.name}</Display>
        <div className="flex flex-wrap gap-x-4 text-sm text-white/80">
          <span>{t("members", { n: c.memberCount })}</span>
          <span>{t("rate", { n: c.completedTrips })}</span>
        </div>
        <ClubActions
          clubId={c.id}
          status={c.myStatus}
          isOrganizer={c.isOrganizer}
          privacy={c.privacy as "open" | "closed"}
        />
      </Panel>

      {(c.description || c.rules) && (
        <Panel className="flex flex-col gap-3">
          {c.description && (
            <div>
              <span className={label}>{t("about")}</span>
              <p className="whitespace-pre-line text-[15px]">{c.description}</p>
            </div>
          )}
          {c.rules && (
            <div>
              <span className={label}>{t("rules")}</span>
              <p className="whitespace-pre-line text-[15px]">{c.rules}</p>
            </div>
          )}
        </Panel>
      )}

      {c.isOrganizer && c.requests.length > 0 && (
        <Panel className="flex flex-col gap-3">
          <span className={label}>{t("requests")}</span>
          {c.requests.map((r) => (
            <div key={r.userId} className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/u/${r.userId}`} className="font-semibold underline-offset-4 hover:underline">
                {r.name}
              </Link>
              <RequestButtons clubId={c.id} userId={r.userId} />
            </div>
          ))}
        </Panel>
      )}

      <Panel className="flex flex-col gap-3">
        <span className={label}>{t("trips")}</span>
        {c.trips.length === 0 && <p className="text-sm text-muted-foreground">{t("noTrips")}</p>}
        {c.trips.map((tr) => (
          <Link
            key={tr.id}
            href={`/trips/${tr.id}`}
            className="flex flex-col border-t border-line pt-3 first:border-t-0 first:pt-0"
          >
            <span className="font-semibold">{tr.title}</span>
            <span className="text-sm text-muted-foreground">
              {formatTripDates({ startDate: tr.start, endDate: tr.end, datePrecision: "exact" }, locale)}
            </span>
          </Link>
        ))}
        {c.isOrganizer && (
          <Link
            href={`/trips/new?club=${c.id}`}
            className="press inline-flex min-h-11 items-center self-start rounded-full bg-ink px-5 text-sm font-medium text-white"
          >
            {t("openTrip")}
          </Link>
        )}
      </Panel>

      {c.privacy === "closed" && !c.isMember ? (
        <Panel className="text-sm text-muted-foreground">{t("closedHint")}</Panel>
      ) : (
        <Panel className="flex flex-col gap-3">
          <span className={label}>{t("posts")}</span>
          {c.isMember && <Composer clubId={c.id} />}
          {c.posts.length === 0 && <p className="text-sm text-muted-foreground">{t("noPosts")}</p>}
          {c.posts.map((p) => (
            <div key={p.id} className="border-t border-line pt-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-semibold">{p.name}</span>
                {(p.userId === user.id || c.isOrganizer) && <PostDelete clubId={c.id} id={p.id} />}
              </div>
              <p className="text-[15px] whitespace-pre-wrap">{p.body}</p>
            </div>
          ))}
        </Panel>
      )}

      {c.isMember && c.members.length > 0 && (
        <Panel className="flex flex-col gap-2">
          <span className={label}>{t("peopleTitle")}</span>
          <div className="flex flex-wrap gap-1.5">
            {c.members.map((m) => (
              <Link
                key={m.userId}
                href={`/u/${m.userId}`}
                className="inline-flex min-h-9 items-center rounded-full border border-input px-3 text-[13px] font-medium"
              >
                {m.name}
              </Link>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
