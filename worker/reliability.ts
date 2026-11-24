// "So'zida turish" (product-decisions §9.4), run hourly by the worker:
//  - 3 and 1 day before departure: "trip_soon" reminder to everyone approved;
//  - 2 days before the ticket deadline and on the day: remind members who haven't marked "Oldim";
//  - after the deadline: their place is freed (status left, chat left) and counted as no_show;
//    the organizer is told how many places opened and how many requests are waiting;
//  - after the trip ends: everyone still approved "went" and the trip is completed.
// Dates are Tashkent dates (first market). Everything is idempotent: re-running changes nothing.
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";

const today = sql`(now() at time zone 'Asia/Tashkent')::date`;

export async function runReliability(db: Db) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`
      insert into notifications (user_id, type, payload, channel)
      select tm.user_id, 'ticket_reminder',
        jsonb_build_object('tripId', t.id, 'n', (t.ticket_deadline - ${today})::text), 'telegram'
      from trips t
      join trip_members tm on tm.trip_id = t.id and tm.status = 'approved' and tm.role = 'member'
      where t.status in ('open', 'full') and (t.ticket_deadline - ${today}) in (0, 2)
        and not exists (select 1 from trip_tickets k where k.trip_id = t.id and k.user_id = tm.user_id)
        and not exists (select 1 from notifications n
          where n.user_id = tm.user_id and n.type = 'ticket_reminder'
            and n.payload->>'tripId' = t.id::text and n.payload->>'n' = (t.ticket_deadline - ${today})::text)`);

    // 3 and 1 day before departure: one reminder per person per day-count.
    await tx.execute(sql`
      insert into notifications (user_id, type, payload, channel)
      select tm.user_id, 'trip_soon',
        jsonb_build_object('tripId', t.id, 'n', (t.start_date - ${today})::text), 'telegram'
      from trips t
      join trip_members tm on tm.trip_id = t.id and tm.status = 'approved'
      where t.status in ('open', 'full') and (t.start_date - ${today}) in (1, 3)
        and not exists (select 1 from notifications n
          where n.user_id = tm.user_id and n.type = 'trip_soon'
            and n.payload->>'tripId' = t.id::text and n.payload->>'n' = (t.start_date - ${today})::text)`);

    await tx.execute(sql`
      with dropped as (
        update trip_members tm set status = 'left'
        from trips t
        where t.id = tm.trip_id and t.status in ('open', 'full') and t.ticket_deadline < ${today}
          and tm.status = 'approved' and tm.role = 'member'
          -- someone approved after the deadline passed is not punished for missing it
          and (tm.updated_at at time zone 'Asia/Tashkent')::date <= t.ticket_deadline
          and not exists (select 1 from trip_tickets k where k.trip_id = t.id and k.user_id = tm.user_id)
        returning tm.trip_id, tm.user_id),
      outcome as (
        insert into reliability (user_id, trip_id, outcome)
        select user_id, trip_id, 'no_show' from dropped on conflict do nothing),
      chat as (
        update conversation_members cm set left_at = now()
        from conversations c, dropped d
        where c.id = cm.conversation_id and c.kind = 'trip_group' and c.trip_id = d.trip_id
          and cm.user_id = d.user_id and cm.left_at is null),
      reopen as (
        update trips set status = 'open' where status = 'full' and id in (select trip_id from dropped)),
      told as (
        insert into notifications (user_id, type, payload, channel)
        select user_id, 'ticket_dropped', jsonb_build_object('tripId', trip_id), 'telegram' from dropped)
      insert into notifications (user_id, type, payload, channel)
      select t.owner_user_id, 'spot_freed',
        jsonb_build_object('tripId', d.trip_id, 'n', count(*)::text,
          'text', (select count(*) from trip_members p where p.trip_id = d.trip_id and p.status = 'requested')::text),
        'telegram'
      from dropped d join trips t on t.id = d.trip_id
      where t.owner_user_id is not null
      group by d.trip_id, t.owner_user_id`);

    await tx.execute(sql`
      with done as (
        update trips set status = 'completed'
        where status in ('open', 'full') and end_date < ${today}
        returning id)
      insert into reliability (user_id, trip_id, outcome)
      select tm.user_id, tm.trip_id, 'went' from trip_members tm
      where tm.status = 'approved' and tm.trip_id in (select id from done)
      on conflict (user_id, trip_id) do update set outcome = 'went'`);
  });
}
