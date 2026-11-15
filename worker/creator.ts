// 1M Safar invite (product-decisions §8): on the trip's 2nd day, from 09:00 Tashkent time, every
// approved member of a trip that was set up in the app before departure gets one private message.
// Skipped for people who already took part this year. Idempotent: one invite per person per trip.
// ponytail: Tashkent clock for every destination; per-country local morning when we go beyond the region.
import { sql } from "drizzle-orm";
import type { Db } from "@/lib/db";

export async function queueCreatorInvites(db: Db) {
  await db.execute(sql`
    insert into notifications (user_id, type, payload, channel)
    select tm.user_id, 'creator_invite', jsonb_build_object('tripId', t.id), 'telegram'
    from trips t
    join trip_members tm on tm.trip_id = t.id and tm.status = 'approved'
    where t.status in ('open', 'full')
      and t.start_date = (now() at time zone 'Asia/Tashkent')::date - 1
      and extract(hour from now() at time zone 'Asia/Tashkent') >= 9
      and t.created_at < t.start_date
      and not exists (select 1 from creator_entries c
        where c.user_id = tm.user_id and c.created_at > now() - interval '1 year')
      and not exists (select 1 from notifications n
        where n.user_id = tm.user_id and n.type = 'creator_invite' and n.payload->>'tripId' = t.id::text)`);
}
