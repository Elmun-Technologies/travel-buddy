// Delivers queued Telegram notifications (notifications.channel = 'telegram', sent_at null).
// At-most-once: rows are claimed (sent_at set) before sending, so a crash never double-sends.
import { sql } from "drizzle-orm";
import type { Api } from "grammy";
import { InlineKeyboard } from "grammy";
import type { Db } from "@/lib/db";

type Lang = "uz" | "ru" | "en";
const lang = (l?: string | null): Lang => (l === "ru" || l === "en" ? l : "uz");
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const T = {
  uz: {
    approvedHead: "SIZNI KUTISHYAPTI!",
    approved: (o: string, trip: string) =>
      `${o} sizni <b>${trip}</b> guruhiga qo'shdi. Tanishib oling — xonangiz ochiq.`,
    approvedBtn: "Guruhga kiraman ↗",
    requestedHead: "YANGI SO'ROV",
    requested: (m: string, trip: string) => `<b>${m}</b> «${trip}» safaringizga qo'shilmoqchi.`,
    requestedBtn: "Ko'rib chiqaman ↗",
  },
  ru: {
    approvedHead: "ВАС ЖДУТ!",
    approved: (o: string, trip: string) =>
      `${o} добавил(а) вас в группу <b>${trip}</b>. Знакомьтесь — комната открыта.`,
    approvedBtn: "Перейти в группу ↗",
    requestedHead: "НОВАЯ ЗАЯВКА",
    requested: (m: string, trip: string) => `<b>${m}</b> хочет присоединиться к поездке «${trip}».`,
    requestedBtn: "Посмотреть ↗",
  },
  en: {
    approvedHead: "THEY'RE WAITING FOR YOU!",
    approved: (o: string, trip: string) => `${o} added you to <b>${trip}</b>. Say hi — your room is open.`,
    approvedBtn: "Open the group ↗",
    requestedHead: "NEW REQUEST",
    requested: (m: string, trip: string) => `<b>${m}</b> wants to join your trip “${trip}”.`,
    requestedBtn: "Take a look ↗",
  },
} as const;

type Row = {
  id: string;
  type: string;
  trip_id: string;
  chat_id: string | null;
  locale: string | null;
  trip: string | null;
  organizer: string | null;
  member: string | null;
};

export async function deliverNotifications(api: Api, db: Db, appUrl: string) {
  const rows = await db.execute<Row>(sql`
    with claimed as (
      update notifications set sent_at = now()
      where id in (
        select id from notifications
        where channel = 'telegram' and sent_at is null
        order by created_at limit 20 for update skip locked)
      returning id, user_id, type, payload)
    select c.id, c.type, c.payload->>'tripId' as trip_id,
      a.provider_user_id as chat_id, u.locale, t.title as trip,
      op.display_name as organizer, mp.display_name as member
    from claimed c
    join users u on u.id = c.user_id
    left join auth_accounts a on a.user_id = c.user_id and a.provider = 'telegram'
    left join trips t on t.id = (c.payload->>'tripId')::uuid
    left join traveler_profiles op on op.user_id = t.owner_user_id
    left join traveler_profiles mp on mp.user_id = (c.payload->>'memberId')::uuid`);

  for (const r of rows) {
    if (!r.chat_id || !r.trip) continue; // sample users (no Telegram) or deleted trip
    const l = lang(r.locale);
    const url = `${appUrl}/${l}/trips/${r.trip_id}`;
    const [head, body, btn] =
      r.type === "join_approved"
        ? [T[l].approvedHead, T[l].approved(esc(r.organizer ?? ""), esc(r.trip)), T[l].approvedBtn]
        : [T[l].requestedHead, T[l].requested(esc(r.member ?? ""), esc(r.trip)), T[l].requestedBtn];
    await api
      .sendMessage(r.chat_id, `<b>${head}</b>\n${body}`, {
        parse_mode: "HTML",
        reply_markup: appUrl.startsWith("https://") ? new InlineKeyboard().webApp(btn, url) : undefined,
      })
      // 403 = the user blocked the bot: nothing to retry (an SMS fallback is a later, opt-in feature).
      .catch((e) => console.error(`notification ${r.id} failed`, e instanceof Error ? e.message : e));
  }
  return rows.length;
}
