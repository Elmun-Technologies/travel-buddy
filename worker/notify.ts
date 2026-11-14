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
    pinHead: "YANGI E'LON",
    pollHead: "YANGI SO'ROVNOMA",
    roomText: (trip: string, text: string) => `«${trip}»: ${text}`,
    pollBtn: "Ovoz beraman ↗",
    digest: (trip: string, n: string) => `«${trip}» guruhida ${n} ta yangi xabar.`,
    proposedHead: "REJAGA TAKLIF",
    proposed: (m: string, trip: string, place: string) =>
      `<b>${m}</b> «${trip}» rejasiga taklif qo'shdi: ${place}.`,
    settleHead: "TO'LOV BELGILANDI",
    settle: (m: string, trip: string, amount: string) =>
      `<b>${m}</b> sizga $${amount} o'tkazganini belgiladi («${trip}»). Pul kelgan bo'lsa, hammasi joyida.`,
    roomBtn: "Xonani ochaman ↗",
    settings: "Bildirishnomalarni profilda sozlash mumkin.",
    reminderHead: "CHIPTA MUDDATI",
    reminder: (trip: string, n: string) =>
      `«${trip}»: chipta olish muddatiga ${n === "0" ? "bugun oxirgi kun" : `${n} kun qoldi`}. Olgan bo'lsangiz, Yig'amiz'da "Chiptani oldim" ni bosing — aks holda joyingiz navbatdagiga beriladi.`,
    droppedHead: "JOYINGIZ BO'SHATILDI",
    dropped: (trip: string) =>
      `«${trip}»: muddatgacha chipta belgilanmadi, joyingiz navbatdagiga berildi. Hali borishni xohlasangiz, qayta so'rov yuboring.`,
    freedHead: "JOY BO'SHADI",
    freed: (trip: string, n: string, waiting: string) =>
      `«${trip}»: ${n} kishi muddatgacha chipta olmadi, joyi bo'shadi. Navbatda ${waiting} ta so'rov bor.`,
    tripBtn: "Safarni ochaman ↗",
  },
  ru: {
    approvedHead: "ВАС ЖДУТ!",
    approved: (o: string, trip: string) =>
      `${o} добавил(а) вас в группу <b>${trip}</b>. Знакомьтесь — комната открыта.`,
    approvedBtn: "Перейти в группу ↗",
    requestedHead: "НОВАЯ ЗАЯВКА",
    requested: (m: string, trip: string) => `<b>${m}</b> хочет присоединиться к поездке «${trip}».`,
    requestedBtn: "Посмотреть ↗",
    pinHead: "НОВОЕ ОБЪЯВЛЕНИЕ",
    pollHead: "НОВЫЙ ОПРОС",
    roomText: (trip: string, text: string) => `«${trip}»: ${text}`,
    pollBtn: "Проголосовать ↗",
    digest: (trip: string, n: string) => `В группе «${trip}» новых сообщений: ${n}.`,
    proposedHead: "ПРЕДЛОЖЕНИЕ В ПЛАН",
    proposed: (m: string, trip: string, place: string) =>
      `<b>${m}</b> предлагает в план «${trip}»: ${place}.`,
    settleHead: "ОТМЕЧЕН ПЕРЕВОД",
    settle: (m: string, trip: string, amount: string) =>
      `<b>${m}</b> отметил(а), что перевёл(а) вам $${amount} («${trip}»). Если деньги пришли — всё в порядке.`,
    roomBtn: "Открыть комнату ↗",
    settings: "Уведомления настраиваются в профиле.",
    reminderHead: "СРОК ПОКУПКИ БИЛЕТОВ",
    reminder: (trip: string, n: string) =>
      `«${trip}»: ${n === "0" ? "сегодня последний день покупки билетов" : `до конца срока покупки билетов ${n} дн.`}. Если купили — нажмите «Я купил(а) билет» во вкладке «Собираемся», иначе место перейдёт следующему.`,
    droppedHead: "ВАШЕ МЕСТО ОСВОБОЖДЕНО",
    dropped: (trip: string) =>
      `«${trip}»: билет не отмечен до срока, место передано следующему. Если всё ещё хотите поехать — отправьте заявку снова.`,
    freedHead: "МЕСТО ОСВОБОДИЛОСЬ",
    freed: (trip: string, n: string, waiting: string) =>
      `«${trip}»: ${n} чел. не купили билет до срока, места освободились. Заявок в очереди: ${waiting}.`,
    tripBtn: "Открыть поездку ↗",
  },
  en: {
    approvedHead: "THEY'RE WAITING FOR YOU!",
    approved: (o: string, trip: string) => `${o} added you to <b>${trip}</b>. Say hi — your room is open.`,
    approvedBtn: "Open the group ↗",
    requestedHead: "NEW REQUEST",
    requested: (m: string, trip: string) => `<b>${m}</b> wants to join your trip “${trip}”.`,
    requestedBtn: "Take a look ↗",
    pinHead: "NEW ANNOUNCEMENT",
    pollHead: "NEW POLL",
    roomText: (trip: string, text: string) => `“${trip}”: ${text}`,
    pollBtn: "Vote ↗",
    digest: (trip: string, n: string) => `${n} new messages in “${trip}”.`,
    proposedHead: "PLAN SUGGESTION",
    proposed: (m: string, trip: string, place: string) =>
      `<b>${m}</b> suggested for the “${trip}” plan: ${place}.`,
    settleHead: "PAYMENT MARKED",
    settle: (m: string, trip: string, amount: string) =>
      `<b>${m}</b> marked sending you $${amount} (“${trip}”). If it arrived, you're all set.`,
    roomBtn: "Open the room ↗",
    settings: "You can change notifications in your profile.",
    reminderHead: "TICKET DEADLINE",
    reminder: (trip: string, n: string) =>
      `“${trip}”: ${n === "0" ? "today is the last day to buy tickets" : `${n} days left to buy tickets`}. If you have yours, tap "I've got my ticket" in the booking tab — otherwise your place goes to the next person.`,
    droppedHead: "YOUR PLACE WAS RELEASED",
    dropped: (trip: string) =>
      `“${trip}”: no ticket was marked by the deadline, so your place went to the next person. Still want to go? Send a request again.`,
    freedHead: "A PLACE OPENED UP",
    freed: (trip: string, n: string, waiting: string) =>
      `“${trip}”: ${n} didn't get a ticket by the deadline, so places opened up. Requests waiting: ${waiting}.`,
    tripBtn: "Open the trip ↗",
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
  text: string | null;
  n: string | null;
  off: boolean;
};

/** Head (optional), body, button label and the path under /trips/<id> the button opens. */
export function render(r: Pick<Row, "type" | "trip" | "organizer" | "member" | "text" | "n">, l: Lang) {
  const t = T[l];
  const trip = esc(r.trip ?? "");
  const member = esc(r.member ?? "");
  const text = esc(r.text ?? "");
  switch (r.type) {
    case "join_approved":
      return {
        head: t.approvedHead,
        body: t.approved(esc(r.organizer ?? ""), trip),
        btn: t.approvedBtn,
        path: "/room",
      };
    case "join_requested":
      return { head: t.requestedHead, body: t.requested(member, trip), btn: t.requestedBtn, path: "" };
    case "room_pin":
      return { head: t.pinHead, body: t.roomText(trip, text), btn: t.roomBtn, path: "/room" };
    case "room_poll":
      return { head: t.pollHead, body: t.roomText(trip, text), btn: t.pollBtn, path: "/room" };
    case "room_digest":
      return { head: null, body: t.digest(trip, r.n ?? "1"), btn: t.roomBtn, path: "/room" };
    case "plan_proposed":
      return { head: t.proposedHead, body: t.proposed(member, trip, text), btn: t.roomBtn, path: "/room" };
    case "settle_received":
      return { head: t.settleHead, body: t.settle(member, trip, text), btn: t.roomBtn, path: "/room" };
    case "ticket_reminder":
      return { head: t.reminderHead, body: t.reminder(trip, r.n ?? "0"), btn: t.roomBtn, path: "/room" };
    case "ticket_dropped":
      return { head: t.droppedHead, body: t.dropped(trip), btn: t.tripBtn, path: "" };
    case "spot_freed":
      return { head: t.freedHead, body: t.freed(trip, r.n ?? "1", text || "0"), btn: t.tripBtn, path: "" };
    default:
      return null;
  }
}

/**
 * Plain chat messages are never sent one by one: at most once an hour per room, "N ta yangi xabar",
 * counting what the member has not seen (an open room page keeps last_read_at fresh).
 * Messages younger than 2 minutes wait, so people chatting live are not pinged.
 */
export async function queueDigests(db: Db) {
  await db.execute(sql`
    with due as (
      select cm.id, cm.user_id, c.trip_id, count(m.id) as n
      from conversation_members cm
      join conversations c on c.id = cm.conversation_id and c.kind = 'trip_group'
      join users u on u.id = cm.user_id and not ('chat' = any(u.notify_off))
      join messages m on m.conversation_id = cm.conversation_id
        and m.sender_id <> cm.user_id and m.kind = 'text' and m.hidden_at is null
        and m.created_at > greatest(coalesce(cm.last_read_at, cm.created_at), coalesce(cm.last_digest_at, cm.created_at))
        and m.created_at < now() - interval '2 minutes'
        and not exists (select 1 from blocks b
          where (b.blocker_id = cm.user_id and b.blocked_id = m.sender_id)
             or (b.blocker_id = m.sender_id and b.blocked_id = cm.user_id))
      where cm.left_at is null
        and (cm.last_digest_at is null or cm.last_digest_at < now() - interval '1 hour')
      group by cm.id, cm.user_id, c.trip_id),
    marked as (update conversation_members set last_digest_at = now() where id in (select id from due))
    insert into notifications (user_id, type, payload, channel)
    select user_id, 'room_digest', jsonb_build_object('tripId', trip_id, 'n', n::text), 'telegram' from due`);
}

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
      c.payload->>'text' as text, c.payload->>'n' as n,
      (case c.type when 'room_pin' then 'pin' when 'room_poll' then 'poll' when 'room_digest' then 'chat'
        else 'mine' end) = any(u.notify_off) as off,
      a.provider_user_id as chat_id, u.locale, t.title as trip,
      op.display_name as organizer, mp.display_name as member
    from claimed c
    join users u on u.id = c.user_id
    left join auth_accounts a on a.user_id = c.user_id and a.provider = 'telegram'
    left join trips t on t.id = (c.payload->>'tripId')::uuid
    left join traveler_profiles op on op.user_id = t.owner_user_id
    left join traveler_profiles mp on mp.user_id = (c.payload->>'memberId')::uuid`);

  for (const r of rows) {
    if (!r.chat_id || !r.trip || r.off) continue; // no Telegram (sample users), deleted trip, or turned off
    const l = lang(r.locale);
    const m = render(r, l);
    if (!m) continue;
    const footer = r.type.startsWith("room_") ? `\n\n<i>${T[l].settings}</i>` : "";
    await api
      .sendMessage(r.chat_id, `${m.head ? `<b>${m.head}</b>\n` : ""}${m.body}${footer}`, {
        parse_mode: "HTML",
        reply_markup: appUrl.startsWith("https://")
          ? new InlineKeyboard().webApp(m.btn, `${appUrl}/${l}/trips/${r.trip_id}${m.path}`)
          : undefined,
      })
      // 403 = the user blocked the bot: nothing to retry (an SMS fallback is a later, opt-in feature).
      .catch((e) => console.error(`notification ${r.id} failed`, e instanceof Error ? e.message : e));
  }
  return rows.length;
}
