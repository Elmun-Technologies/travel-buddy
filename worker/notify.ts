// Delivers queued Telegram notifications (notifications.channel = 'telegram', sent_at null).
// At-least-once with retries: see deliverNotifications.
import { sql } from "drizzle-orm";
import type { Api } from "grammy";
import { InlineKeyboard } from "grammy";
import type { Db } from "@/lib/db";
import { mainNumber } from "@/lib/emergency";
import { rateLimit } from "@/lib/rate-limit";
import { smsProvider } from "@/lib/sms";

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
    sosHead: "SOS — YORDAM KERAK",
    sos: (m: string, trip: string) => `<b>${m}</b> «${trip}» safarida yordam so'ramoqda.`,
    where: "Joylashuv",
    localNumber: "Mahalliy favqulodda raqam",
    mapBtn: "Xaritada ko'rish ↗",
    checkinHead: "HAMMASI JOYIDA",
    checkin: (m: string, trip: string) => `<b>${m}</b> «${trip}» safarida hammasi joyida ekanini belgiladi.`,
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
    updatedHead: "SAFAR YANGILANDI",
    updated: (trip: string) =>
      `«${trip}»: tashkilotchi safar tafsilotlarini yangiladi. Yangi sana va shartlarni ko'rib chiqing.`,
    rejectedHead: "SO'ROVINGIZ BO'YICHA",
    rejected: (trip: string) =>
      `«${trip}» guruhi hozircha boshqa tarkibda yig'ilmoqda. Sizga mos boshqa safarlar ko'p — ko'rib chiqamizmi?`,
    feedBtn: "Safarlarni ko'raman ↗",
    reviewHead: "SAFAR TUGADI",
    review: (trip: string) =>
      `«${trip}» safari tugadi. Birga borganlarga baho bering — keyingi sayohatchilar ishonch bilan tanlaydi.`,
    reviewBtn: "Baho beraman ↗",
    dmHead: "YANGI XABAR",
    dm: (m: string) => `<b>${m}</b> sizga yozdi.`,
    dmBtn: "Javob beraman ↗",
    clubReqHead: "KLUBGA SO'ROV",
    clubReq: (m: string, club: string) => `<b>${m}</b> «${club}» klubiga qo'shilmoqchi.`,
    clubApprHead: "KLUBGA QABUL QILINDINGIZ",
    clubAppr: (club: string) => `«${club}» klubiga xush kelibsiz! Yangiliklar va safarlar shu yerda.`,
    clubBtn: "Klubni ochaman ↗",
    gpPin: "YANGI E'LON",
    gpPoll: "YANGI SO'ROVNOMA",
    gpUpdate: "SAFAR YANGILANDI",
    matchHead: "SIZGA MOS SAFAR",
    match: (trip: string, n: string) =>
      `«${trip}» — ${n}% mos. Sana, joy va uslub sizning rejalaringizga yaqin.`,
    inviteHead: "SAFARGA TAKLIF",
    invite: (m: string, trip: string) => `<b>${m}</b> sizni «${trip}» safariga taklif qildi.`,
    leadNewHead: "YANGI ARIZA",
    leadNew: (m: string, tour: string) => `<b>${m}</b> «${tour}» turiga ariza qoldirdi.`,
    leadNewBtn: "Arizalarni ko'raman ↗",
    leadOkHead: "ARIZANGIZ QABUL QILINDI",
    leadOk: (tour: string) =>
      `«${tour}» bo'yicha agentlik arizangizni qabul qildi. Savollaringiz bo'lsa, chatda yozing.`,
    leadOkBtn: "Chatni ochaman ↗",
    leadNoHead: "ARIZA BO'YICHA",
    leadNo: (tour: string) =>
      `Afsuski, «${tour}» turida hozir joy yo'q. Boshqa takliflarni ko'rib chiqamizmi?`,
    soonHead: "SAFAR YAQINLASHDI",
    soon: (trip: string, n: string) =>
      `«${trip}» safariga ${n === "1" ? "1 kun" : `${n} kun`} qoldi. Hujjat, chipta va yig'ilish joyini tekshirib oling.`,
    creatorHead: "SAFARNING 2-KUNI · SIZ UCHUN",
    creator: (trip: string) =>
      `«${trip}» zo'rmi? Bir sir aytamiz: shu safardan olgan Reels'ingiz <b>1 mln ko'rish</b> yig'sa, chipta va mehmonxona xarajatingizni <b>$1 000 gacha</b> qoplab beramiz.\n\nFaqat shu safardagilar uchun. Qaytgach 30 kun ichida joylashga ulgurasiz.`,
    creatorBtn: "Shartlarni ko'raman ↗",
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
    sosHead: "SOS — НУЖНА ПОМОЩЬ",
    sos: (m: string, trip: string) => `<b>${m}</b> просит о помощи в поездке «${trip}».`,
    where: "Местоположение",
    localNumber: "Местный экстренный номер",
    mapBtn: "Открыть на карте ↗",
    checkinHead: "ВСЁ В ПОРЯДКЕ",
    checkin: (m: string, trip: string) => `<b>${m}</b> отметил(а), что в поездке «${trip}» всё в порядке.`,
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
    updatedHead: "ПОЕЗДКА ОБНОВЛЕНА",
    updated: (trip: string) =>
      `«${trip}»: организатор обновил детали поездки. Посмотрите новые даты и условия.`,
    rejectedHead: "ПО ВАШЕЙ ЗАЯВКЕ",
    rejected: (trip: string) =>
      `Группа «${trip}» пока собирается в другом составе. Подходящих поездок много — посмотрим?`,
    feedBtn: "Смотреть поездки ↗",
    reviewHead: "ПОЕЗДКА ЗАВЕРШЕНА",
    review: (trip: string) =>
      `Поездка «${trip}» закончилась. Оцените попутчиков — следующие путешественники будут выбирать увереннее.`,
    reviewBtn: "Оценить ↗",
    dmHead: "НОВОЕ СООБЩЕНИЕ",
    dm: (m: string) => `<b>${m}</b> написал(а) вам.`,
    dmBtn: "Ответить ↗",
    clubReqHead: "ЗАЯВКА В КЛУБ",
    clubReq: (m: string, club: string) => `<b>${m}</b> хочет вступить в клуб «${club}».`,
    clubApprHead: "ВАС ПРИНЯЛИ В КЛУБ",
    clubAppr: (club: string) => `Добро пожаловать в клуб «${club}»! Новости и поездки — здесь.`,
    clubBtn: "Открыть клуб ↗",
    gpPin: "НОВОЕ ОБЪЯВЛЕНИЕ",
    gpPoll: "НОВЫЙ ОПРОС",
    gpUpdate: "ПОЕЗДКА ОБНОВЛЕНА",
    matchHead: "ПОДХОДЯЩАЯ ПОЕЗДКА",
    match: (trip: string, n: string) =>
      `«${trip}» — совпадение ${n}%. Даты, место и стиль близки к вашим планам.`,
    inviteHead: "ПРИГЛАШЕНИЕ В ПОЕЗДКУ",
    invite: (m: string, trip: string) => `<b>${m}</b> приглашает вас в поездку «${trip}».`,
    leadNewHead: "НОВАЯ ЗАЯВКА",
    leadNew: (m: string, tour: string) => `<b>${m}</b> оставил(а) заявку на тур «${tour}».`,
    leadNewBtn: "Открыть заявки ↗",
    leadOkHead: "ЗАЯВКА ПРИНЯТА",
    leadOk: (tour: string) =>
      `Агентство приняло вашу заявку на тур «${tour}». Если есть вопросы — пишите в чате.`,
    leadOkBtn: "Открыть чат ↗",
    leadNoHead: "ПО ВАШЕЙ ЗАЯВКЕ",
    leadNo: (tour: string) => `К сожалению, на тур «${tour}» сейчас нет мест. Посмотрим другие предложения?`,
    soonHead: "ПОЕЗДКА СОВСЕМ СКОРО",
    soon: (trip: string, n: string) =>
      `До поездки «${trip}» ${n === "1" ? "остался 1 день" : `осталось ${n} дня`}. Проверьте документы, билеты и место встречи.`,
    creatorHead: "2-Й ДЕНЬ ПОЕЗДКИ · ДЛЯ ВАС",
    creator: (trip: string) =>
      `Как «${trip}»? Открываем секрет: если ваш Reels из этой поездки наберёт <b>1 млн просмотров</b>, вернём расходы на билеты и отель <b>до $1 000</b>.\n\nТолько для участников этой поездки. Опубликовать можно в течение 30 дней после возвращения.`,
    creatorBtn: "Смотреть условия ↗",
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
    sosHead: "SOS — HELP NEEDED",
    sos: (m: string, trip: string) => `<b>${m}</b> is asking for help on the “${trip}” trip.`,
    where: "Location",
    localNumber: "Local emergency number",
    mapBtn: "Open the map ↗",
    checkinHead: "ALL GOOD",
    checkin: (m: string, trip: string) => `<b>${m}</b> marked that all is well on the “${trip}” trip.`,
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
    updatedHead: "TRIP UPDATED",
    updated: (trip: string) =>
      `“${trip}”: the organizer updated the trip details. Take a look at the new dates and terms.`,
    rejectedHead: "ABOUT YOUR REQUEST",
    rejected: (trip: string) =>
      `The “${trip}” group is coming together with a different lineup for now. Plenty of other trips fit you — shall we look?`,
    feedBtn: "Browse trips ↗",
    reviewHead: "TRIP FINISHED",
    review: (trip: string) =>
      `“${trip}” is over. Rate the people you travelled with — it helps future travellers choose with confidence.`,
    reviewBtn: "Leave ratings ↗",
    dmHead: "NEW MESSAGE",
    dm: (m: string) => `<b>${m}</b> wrote to you.`,
    dmBtn: "Reply ↗",
    clubReqHead: "CLUB REQUEST",
    clubReq: (m: string, club: string) => `<b>${m}</b> wants to join the “${club}” club.`,
    clubApprHead: "YOU'RE IN THE CLUB",
    clubAppr: (club: string) => `Welcome to “${club}”! News and trips are there.`,
    clubBtn: "Open the club ↗",
    gpPin: "NEW ANNOUNCEMENT",
    gpPoll: "NEW POLL",
    gpUpdate: "TRIP UPDATED",
    matchHead: "A TRIP THAT FITS YOU",
    match: (trip: string, n: string) =>
      `“${trip}” — ${n}% match. Dates, place and style are close to your plans.`,
    inviteHead: "TRIP INVITATION",
    invite: (m: string, trip: string) => `<b>${m}</b> invited you to “${trip}”.`,
    leadNewHead: "NEW REQUEST",
    leadNew: (m: string, tour: string) => `<b>${m}</b> sent a request for “${tour}”.`,
    leadNewBtn: "Open requests ↗",
    leadOkHead: "REQUEST ACCEPTED",
    leadOk: (tour: string) => `The agency accepted your request for “${tour}”. Questions? Write in the chat.`,
    leadOkBtn: "Open the chat ↗",
    leadNoHead: "ABOUT YOUR REQUEST",
    leadNo: (tour: string) => `Sorry, “${tour}” has no seats right now. Shall we look at other offers?`,
    soonHead: "TRIP IS COMING UP",
    soon: (trip: string, n: string) =>
      `“${trip}” is ${n === "1" ? "1 day" : `${n} days`} away. Check your documents, tickets and meeting point.`,
    creatorHead: "DAY 2 OF THE TRIP · FOR YOU",
    creator: (trip: string) =>
      `Enjoying «${trip}»? Here's a secret: if your Reel from this trip reaches <b>1M views</b>, we refund your flights and hotel <b>up to $1,000</b>.\n\nOnly for people on this trip. You have 30 days after you return to post it.`,
    creatorBtn: "See the terms ↗",
  },
} as const;

type Row = {
  id: string;
  type: string;
  trip_id: string;
  conv_id?: string | null;
  club_id?: string | null;
  user_id?: string;
  phone?: string | null;
  phone_ok?: boolean;
  sms?: boolean;
  kind?: string | null;
  link?: string | null;
  chat_id: string | null;
  locale: string | null;
  trip: string | null;
  organizer: string | null;
  member: string | null;
  text: string | null;
  n: string | null;
  off: boolean;
  inactive?: boolean; // the recipient deleted or lost their account
  to_chat: string | null; // a trusted contact's chat instead of the user's own
  lat: string | null;
  lng: string | null;
  country: string | null;
};

/** Head (optional), body, button label and the path under /trips/<id> the button opens. */
export function render(
  r: Pick<Row, "type" | "trip" | "organizer" | "member" | "text" | "n"> &
    Partial<Pick<Row, "lat" | "lng" | "country" | "conv_id" | "club_id" | "kind" | "link">>,
  l: Lang,
) {
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
    case "sos":
    case "sos_contact": {
      const map = r.lat && r.lng ? `https://maps.google.com/?q=${r.lat},${r.lng}` : null;
      const num = r.country ? mainNumber(r.country) : null;
      const body = [
        t.sos(member, trip),
        map && `${t.where}: ${map}`,
        num && `${t.localNumber}: <b>${num}</b>`,
      ]
        .filter(Boolean)
        .join("\n");
      return { head: t.sosHead, body, btn: t.roomBtn, path: "/room", map };
    }
    case "trip_updated":
      return { head: t.updatedHead, body: t.updated(trip), btn: t.tripBtn, path: "" };
    case "join_rejected":
      return { head: t.rejectedHead, body: t.rejected(trip), btn: t.feedBtn, path: "", to: "/trips" };
    case "review_ask":
      return { head: t.reviewHead, body: t.review(trip), btn: t.reviewBtn, path: "/reviews" };
    case "dm":
      return {
        head: t.dmHead,
        body: t.dm(member),
        btn: t.dmBtn,
        path: "",
        to: r.conv_id ? `/chats/${r.conv_id}` : "/rooms",
      };
    case "club_requested":
      return {
        head: t.clubReqHead,
        body: t.clubReq(member, text),
        btn: t.clubBtn,
        path: "",
        to: r.club_id ? `/clubs/${r.club_id}` : "/clubs",
      };
    case "club_approved":
      return {
        head: t.clubApprHead,
        body: t.clubAppr(text),
        btn: t.clubBtn,
        path: "",
        to: r.club_id ? `/clubs/${r.club_id}` : "/clubs",
      };
    case "lead_new":
      return {
        head: t.leadNewHead,
        body: t.leadNew(member, text),
        btn: t.leadNewBtn,
        path: "",
        to: "/agency",
      };
    case "lead_accepted":
      return {
        head: t.leadOkHead,
        body: t.leadOk(text),
        btn: t.leadOkBtn,
        path: "",
        to: r.conv_id ? `/chats/${r.conv_id}` : "/rooms",
      };
    case "lead_rejected":
      return { head: t.leadNoHead, body: t.leadNo(text), btn: t.feedBtn, path: "", to: "/trips" };
    case "match_trip":
      return { head: t.matchHead, body: t.match(trip, r.n ?? "0"), btn: t.tripBtn, path: "" };
    case "trip_invite":
      return { head: t.inviteHead, body: t.invite(member, trip), btn: t.tripBtn, path: "" };
    case "group_post":
      return {
        head: r.kind === "pin" ? t.gpPin : r.kind === "poll" ? t.gpPoll : t.gpUpdate,
        body: `«${trip}»: ${text}`,
        btn: t.tripBtn,
        path: "",
        url: r.link ?? null,
      };
    case "trip_soon":
      return { head: t.soonHead, body: t.soon(trip, r.n ?? "3"), btn: t.roomBtn, path: "/room" };
    case "creator_invite":
      return { head: t.creatorHead, body: t.creator(trip), btn: t.creatorBtn, path: "/creator" };
    case "checkin_contact":
      return { head: t.checkinHead, body: t.checkin(member, trip), btn: null, path: "" };
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

/** Messages that are about something other than a trip. */
const TRIPLESS = new Set([
  "dm",
  "club_requested",
  "club_approved",
  "lead_new",
  "lead_accepted",
  "lead_rejected",
]);

/** Up to this many tries per message; the wait grows: 1, 2, 4, 8, 16 minutes. */
const MAX_ATTEMPTS = 6;
const LEASE_MINUTES = 2;

/** Telegram errors that will never succeed on a retry (bot blocked, chat gone, bad request). */
function isTerminal(e: unknown) {
  const code = (e as { error_code?: number } | null)?.error_code;
  return code === 400 || code === 401 || code === 403 || code === 404;
}

/**
 * At-least-once delivery. A claimed row is leased for a couple of minutes (attempts + 1,
 * next_attempt_at later) and only marked sent after Telegram accepted it. A crash, a network error
 * or a 429 therefore means "try again later", never "lost". SOS goes first, always.
 */
/** Only these may become a text message, and only for people who agreed to it. */
const SMS_TYPES = new Set(["sos", "creator_invite"]);
const SMS = {
  uz: {
    sos: (m: string, trip: string) => `${m} «${trip}» safarida yordam so'ramoqda. Telegram'ni oching.`,
    creator: (trip: string, url: string) => `«${trip}» safaringiz uchun shaxsiy taklif: ${url}`,
  },
  ru: {
    sos: (m: string, trip: string) => `${m} просит о помощи в поездке «${trip}». Откройте Telegram.`,
    creator: (trip: string, url: string) => `Личное предложение для вашей поездки «${trip}»: ${url}`,
  },
  en: {
    sos: (m: string, trip: string) => `${m} is asking for help on the “${trip}” trip. Open Telegram.`,
    creator: (trip: string, url: string) => `A personal offer for your “${trip}” trip: ${url}`,
  },
} as const;

/** The bot cannot reach this person: for SOS and the prepared offer, text them (consent, verified phone, max 3 a day). */
async function smsFallback(r: Row, l: Lang) {
  const provider = smsProvider();
  if (!provider || !SMS_TYPES.has(r.type) || !r.sms || !r.phone_ok || !r.phone || r.to_chat || !r.trip)
    return;
  if (!(await rateLimit(`sms:user:${r.user_id}`, 3, 86_400))) return;
  const plain = (s: string | null) => (s ?? "").replace(/[<>]/g, "");
  const text =
    r.type === "sos"
      ? SMS[l].sos(plain(r.member), plain(r.trip))
      : SMS[l].creator(plain(r.trip), `${process.env.APP_URL ?? ""}/${l}/trips/${r.trip_id}/creator`);
  await provider.send(r.phone, text);
}

export async function deliverNotifications(api: Api, db: Db, appUrl: string) {
  const rows = await db.execute<Row>(sql`
    with claimed as (
      update notifications set attempts = attempts + 1,
        next_attempt_at = now() + make_interval(mins => ${LEASE_MINUTES}) * power(2, attempts)
      where id in (
        select id from notifications
        where channel = 'telegram' and sent_at is null and attempts < ${MAX_ATTEMPTS}
          and (next_attempt_at is null or next_attempt_at <= now())
        order by (type in ('sos', 'sos_contact')) desc, created_at limit 20 for update skip locked)
      returning id, user_id, type, payload)
    select c.id, c.user_id, c.type, c.payload->>'tripId' as trip_id, c.payload->>'convId' as conv_id, c.payload->>'clubId' as club_id, c.payload->>'kind' as kind, c.payload->>'link' as link,
      c.payload->>'text' as text, c.payload->>'n' as n, c.payload->>'chatId' as to_chat,
      c.payload->>'lat' as lat, c.payload->>'lng' as lng, t.destination_country as country,
      -- SOS and messages to trusted contacts can never be turned off
      (case when c.type in ('sos', 'sos_contact', 'checkin_contact', 'group_post') then 'always'
        when c.type = 'room_pin' then 'pin' when c.type = 'room_poll' then 'poll'
        when c.type in ('room_digest', 'dm') then 'chat' when c.type = 'match_trip' then 'match' else 'mine' end) = any(u.notify_off) as off,
      (u.status <> 'active') as inactive,
      u.phone, u.phone_verified as phone_ok, u.sms_consent as sms,
      a.provider_user_id as chat_id, u.locale, t.title as trip,
      op.display_name as organizer, mp.display_name as member
    from claimed c
    join users u on u.id = c.user_id
    left join auth_accounts a on a.user_id = c.user_id and a.provider = 'telegram'
    left join trips t on t.id = nullif(c.payload->>'tripId', '')::uuid
    left join traveler_profiles op on op.user_id = t.owner_user_id
    left join traveler_profiles mp on mp.user_id = nullif(c.payload->>'memberId', '')::uuid`);

  const done = (id: string) => db.execute(sql`update notifications set sent_at = now() where id = ${id}`);

  for (const r of rows) {
    const chat = r.to_chat ?? r.chat_id;
    // Nothing to send: no Telegram (sample users), deleted trip, turned off, or the person is gone.
    if (!chat || (!r.trip && !TRIPLESS.has(r.type)) || r.off || r.inactive) {
      await done(r.id);
      continue;
    }
    const l = lang(r.locale);
    const m = render(r, l);
    if (!m) {
      await done(r.id);
      continue;
    }
    const footer = r.type.startsWith("room_") ? `\n\n<i>${T[l].settings}</i>` : "";
    // Trusted contacts are not in the app: they get a map link, not a Mini App button.
    const kb = r.to_chat
      ? "map" in m && m.map
        ? new InlineKeyboard().url(T[l].mapBtn, m.map)
        : "url" in m && m.url && m.btn
          ? new InlineKeyboard().url(m.btn, m.url)
          : undefined
      : m.btn && appUrl.startsWith("https://")
        ? new InlineKeyboard().webApp(
            m.btn,
            "to" in m && m.to ? `${appUrl}/${l}${m.to}` : `${appUrl}/${l}/trips/${r.trip_id}${m.path}`,
          )
        : undefined;
    try {
      await api.sendMessage(chat, `${m.head ? `<b>${m.head}</b>\n` : ""}${m.body}${footer}`, {
        parse_mode: "HTML",
        reply_markup: kb,
        link_preview_options: { is_disabled: true },
      });
      await done(r.id);
    } catch (e) {
      const err = e as { error_code?: number; parameters?: { retry_after?: number } };
      if (isTerminal(e)) {
        // The user blocked the bot or the chat is gone: nothing to retry.
        console.error(`notification ${r.id} dropped: ${e instanceof Error ? e.message : e}`);
        await smsFallback(r, l);
        await done(r.id);
      } else {
        const wait = err.error_code === 429 ? (err.parameters?.retry_after ?? 5) : null;
        if (wait != null)
          await db.execute(
            sql`update notifications set next_attempt_at = now() + make_interval(secs => ${wait}) where id = ${r.id}`,
          );
        console.error(`notification ${r.id} will be retried`, e instanceof Error ? e.message : e);
      }
    }
  }
  return rows.length;
}
