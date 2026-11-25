import "server-only";
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { ageOn, todayISO } from "@/lib/catalog";
import { getMatchProfiles } from "@/modules/profiles/service";
import { matchTrip } from "./score";
import { travelerFor } from "./service";

// Matching in the background (CLAUDE.md §6): a new open trip is compared with the people whose dream
// countries or "sherik izlayapman" notes fit; good matches are stored in match_suggestions, and the bot
// tells each person about at most 3 of them a day. One trip is never suggested to the same person twice.

const MIN_PERCENT = 50;
const MAX_PER_DAY = 3;
/** Sample trips of the staging seed must not message real testers. */
const SEED_PREFIX = "00000000-0000-4000-8000-";

type Cand = { user_id: string };

/** People who could fit a trip: not in it, not blocked, and a dream country or a dated note that fits. */
export async function candidateIds(
  db: Db,
  tripId: string,
  opts: { onlyIntents?: boolean; excludeSuggested?: boolean } = {},
) {
  const rows = await db.execute<Cand>(sql`
    select u.id as user_id
    from trips t
    join users u on u.status = 'active' and u.id is distinct from t.owner_user_id
    join traveler_profiles p on p.user_id = u.id
    where t.id = ${tripId}
      and not exists (select 1 from trip_members m where m.trip_id = t.id and m.user_id = u.id and m.status in ('requested', 'approved'))
      and not exists (select 1 from blocks b
        where (b.blocker_id = u.id and b.blocked_id = t.owner_user_id) or (b.blocker_id = t.owner_user_id and b.blocked_id = u.id))
      and (${opts.onlyIntents ?? false} = false and p.dream_destinations @> array[t.destination_country]
        or exists (select 1 from travel_intents i
          where i.user_id = u.id and i.status = 'active' and i.destination_country = t.destination_country
            and i.end_date >= t.start_date - t.date_flex_days and i.start_date <= t.end_date + t.date_flex_days))
      and (${opts.excludeSuggested ?? false} = false or not exists (
        select 1 from match_suggestions s where s.user_id = u.id and s.target_type = 'trip' and s.target_id = t.id))
    limit 300`);
  return rows.map((r) => r.user_id);
}

/** Score one person against one trip row; null = hard filter (never suggested). */
export async function scoreFor(userId: string, trip: TripRow) {
  const [u, organizers] = await Promise.all([
    travelerFor(userId),
    getMatchProfiles(trip.ownerUserId ? [trip.ownerUserId] : []),
  ]);
  if (!u) return null;
  return matchTrip(u, {
    country: trip.destinationCountry,
    startDate: trip.startDate,
    endDate: trip.endDate,
    flexDays: trip.dateFlexDays,
    budgetMin: trip.budgetMin,
    budgetMax: trip.budgetMax,
    styles: trip.travelStyles,
    ageMin: trip.ageMin,
    ageMax: trip.ageMax,
    womenOnly: trip.womenOnly,
    organizer: trip.ownerUserId ? (organizers.get(trip.ownerUserId) ?? null) : null,
  });
}

export type TripRow = {
  id: string;
  ownerUserId: string | null;
  destinationCountry: string;
  startDate: string;
  endDate: string;
  dateFlexDays: number;
  budgetMin: number | null;
  budgetMax: number | null;
  travelStyles: string[];
  ageMin: number | null;
  ageMax: number | null;
  womenOnly: boolean;
};

/** Every 15 minutes (worker): find matches for fresh trips, then tell people (≤ 3 a day each). */
export async function runMatching(db: Db) {
  const fresh = await db.execute<{
    id: string;
    owner_user_id: string | null;
    destination_country: string;
    start_date: string;
    end_date: string;
    date_flex_days: number;
    budget_min: number | null;
    budget_max: number | null;
    travel_styles: string[];
    age_min: number | null;
    age_max: number | null;
    women_only: boolean;
  }>(sql`
    select id, owner_user_id, destination_country, start_date::text, end_date::text, date_flex_days,
      budget_min, budget_max, travel_styles, age_min, age_max, women_only
    from trips
    where kind = 'independent' and status = 'open' and created_at > now() - interval '3 days'
      and start_date > ${todayISO()}::date and id::text not like ${`${SEED_PREFIX}%`}
    order by created_at desc limit 50`);
  let stored = 0;
  for (const f of fresh) {
    const trip: TripRow = {
      id: f.id,
      ownerUserId: f.owner_user_id,
      destinationCountry: f.destination_country,
      startDate: f.start_date,
      endDate: f.end_date,
      dateFlexDays: f.date_flex_days,
      budgetMin: f.budget_min,
      budgetMax: f.budget_max,
      travelStyles: f.travel_styles,
      ageMin: f.age_min,
      ageMax: f.age_max,
      womenOnly: f.women_only,
    };
    for (const userId of await candidateIds(db, trip.id, { excludeSuggested: true })) {
      const m = await scoreFor(userId, trip);
      if (!m || m.percent == null || m.percent < MIN_PERCENT) continue;
      await db.execute(sql`
        insert into match_suggestions (user_id, target_type, target_id, score, reasons)
        values (${userId}, 'trip', ${trip.id}, ${m.percent}, ${JSON.stringify(m.reasons)}::jsonb)
        on conflict (user_id, target_type, target_id) do nothing`);
      stored++;
    }
  }
  return { stored, told: await tellAboutMatches(db) };
}

/** Queue the bot messages: best first, at most 3 per person in 24 hours, only trips still open. */
export async function tellAboutMatches(db: Db) {
  const rows = await db.execute<{ id: string }>(sql`
    with ranked as (
      select s.id, s.user_id, s.target_id, s.score,
        row_number() over (partition by s.user_id order by s.score desc, s.created_at) as rn,
        (select count(*) from notifications n where n.user_id = s.user_id and n.type = 'match_trip'
           and n.created_at > now() - interval '24 hours') as sent_today,
        t.status, t.start_date
      from match_suggestions s
      join trips t on t.id = s.target_id
      join users u on u.id = s.user_id and u.status = 'active'
      where s.shown_at is null and s.target_type = 'trip'),
    due as (
      select id, user_id, target_id, score from ranked
      where status = 'open' and start_date > ${todayISO()}::date and rn + sent_today <= ${MAX_PER_DAY}),
    marked as (update match_suggestions set shown_at = now() where id in (select id from due) returning id),
    stale as (
      update match_suggestions set shown_at = now()
      where shown_at is null and target_type = 'trip'
        and target_id in (select id from trips where status <> 'open' or start_date <= ${todayISO()}::date)
      returning id),
    told as (
      insert into notifications (user_id, type, payload, channel)
      select user_id, 'match_trip', jsonb_build_object('tripId', target_id, 'n', round(score)::text), 'telegram' from due
      returning id)
    select id from told`);
  return rows.length;
}

// ---------- people for a trip (organizer's view) ----------

/**
 * People who left a "sherik izlayapman" note that fits this trip, best match first. The organizer
 * sees a name, an age and a percent — nothing else — and may invite them with one tap.
 */
export async function candidatesForTrip(db: Db, organizerId: string, tripId: string) {
  const [t] = await db.execute<{
    id: string;
    owner_user_id: string | null;
    destination_country: string;
    start_date: string;
    end_date: string;
    date_flex_days: number;
    budget_min: number | null;
    budget_max: number | null;
    travel_styles: string[];
    age_min: number | null;
    age_max: number | null;
    women_only: boolean;
    status: string;
  }>(sql`
    select id, owner_user_id, destination_country, start_date::text, end_date::text, date_flex_days,
      budget_min, budget_max, travel_styles, age_min, age_max, women_only, status
    from trips where id = ${tripId} and owner_user_id = ${organizerId}`);
  if (!t || t.status !== "open") return [];
  const trip: TripRow = {
    id: t.id,
    ownerUserId: t.owner_user_id,
    destinationCountry: t.destination_country,
    startDate: t.start_date,
    endDate: t.end_date,
    dateFlexDays: t.date_flex_days,
    budgetMin: t.budget_min,
    budgetMax: t.budget_max,
    travelStyles: t.travel_styles,
    ageMin: t.age_min,
    ageMax: t.age_max,
    womenOnly: t.women_only,
  };
  const scored: { userId: string; percent: number }[] = [];
  for (const id of await candidateIds(db, tripId, { onlyIntents: true })) {
    const m = await scoreFor(id, trip);
    if (m && (m.percent ?? 0) >= 40) scored.push({ userId: id, percent: m.percent! });
  }
  scored.sort((a, b) => b.percent - a.percent);
  const top = scored.slice(0, 10);
  if (!top.length) return [];
  const [profiles, invited] = await Promise.all([
    db.execute<{ user_id: string; display_name: string; birth_date: string }>(sql`
      select user_id, display_name, birth_date::text from traveler_profiles where user_id in ${sql`(${sql.join(
        top.map((x) => sql`${x.userId}::uuid`),
        sql`, `,
      )})`}`),
    db.execute<{ user_id: string }>(sql`
      select user_id from notifications where type = 'trip_invite' and payload->>'tripId' = ${tripId}`),
  ]);
  const byId = new Map(profiles.map((p) => [p.user_id, p]));
  const done = new Set(invited.map((i) => i.user_id));
  return top.flatMap((x) => {
    const p = byId.get(x.userId);
    return p ? [{ ...x, name: p.display_name, age: ageOn(p.birth_date), invited: done.has(x.userId) }] : [];
  });
}

/** One invitation per person per trip; the person gets a bot message with the trip. */
export async function inviteCandidate(db: Db, organizerId: string, tripId: string, userId: string) {
  const allowed = (await candidatesForTrip(db, organizerId, tripId)).find((c) => c.userId === userId);
  if (!allowed) return "not_found" as const;
  if (allowed.invited) return "already" as const;
  await db.execute(sql`
    insert into notifications (user_id, type, payload, channel)
    values (${userId}, 'trip_invite', jsonb_build_object('tripId', ${tripId}::text, 'memberId', ${organizerId}::text), 'telegram')`);
  await db.execute(sql`
    insert into match_suggestions (user_id, target_type, target_id, score, reasons, shown_at, action)
    values (${userId}, 'trip', ${tripId}, ${allowed.percent}, '[]'::jsonb, now(), 'invited')
    on conflict (user_id, target_type, target_id) do update set action = 'invited'`);
  return "ok" as const;
}
