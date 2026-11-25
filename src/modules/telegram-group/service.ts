import "server-only";
import { randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { trips } from "@/db/schema";
import { type DbOrTx, getDb } from "@/lib/db";
import { getTelegramId } from "@/modules/auth/service";
import { approvedMemberIds } from "@/modules/groups/service";

// The trip's own Telegram group (optional). The organizer adds our bot to the group, gets a one-time
// code in the app and sends "/link CODE" there. From then on the bot posts the important things
// (pinned notice, polls, changed dates) into the group, and approved members get a personal,
// single-use invite link from the app — nobody else gets one.

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const newCode = () => Array.from(randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join("");
const CODE_MINUTES = 30;

export async function groupStatus(userId: string, tripId: string) {
  const [t] = await getDb()
    .select({
      owner: trips.ownerUserId,
      chat: trips.tgChatId,
      title: trips.tgChatTitle,
      code: trips.tgLinkCode,
      expires: trips.tgLinkExpires,
      tripTitle: trips.title,
      status: trips.status,
    })
    .from(trips)
    .where(eq(trips.id, tripId));
  if (!t || t.owner === null) return null;
  const isOrganizer = t.owner === userId;
  if (!isOrganizer && !(await approvedMemberIds(getDb(), tripId, "")).includes(userId)) return null;
  const codeValid = !!t.code && !!t.expires && t.expires.getTime() > Date.now();
  return {
    isOrganizer,
    tripTitle: t.tripTitle,
    linked: !!t.chat,
    chatTitle: t.title,
    code: isOrganizer && codeValid ? t.code : null,
    codeExpires: isOrganizer && codeValid ? t.expires!.toISOString() : null,
  };
}

/** Organizer asks for a fresh one-time code (30 minutes). */
export async function startLink(userId: string, tripId: string) {
  const code = newCode();
  const r = await getDb()
    .update(trips)
    .set({ tgLinkCode: code, tgLinkExpires: new Date(Date.now() + CODE_MINUTES * 60_000) })
    .where(and(eq(trips.id, tripId), eq(trips.ownerUserId, userId), eq(trips.kind, "independent")))
    .returning({ id: trips.id });
  return r.length ? code : null;
}

export async function unlinkGroup(userId: string, tripId: string) {
  const r = await getDb()
    .update(trips)
    .set({ tgChatId: null, tgChatTitle: null, tgLinkCode: null, tgLinkExpires: null })
    .where(and(eq(trips.id, tripId), eq(trips.ownerUserId, userId)))
    .returning({ id: trips.id });
  return r.length > 0;
}

export type LinkResult =
  { ok: true; tripTitle: string } | { ok: false; error: "bad_code" | "not_organizer" | "chat_taken" };

/**
 * The bot saw "/link CODE" in a group. The code must be alive, the sender must be the organizer
 * (the Telegram account that signed in to the app), and one group serves one trip.
 */
export async function completeLink(
  code: string,
  chatId: string,
  chatTitle: string,
  senderTelegramId: number,
): Promise<LinkResult> {
  return getDb().transaction(async (tx) => {
    const [t] = await tx
      .select({ id: trips.id, owner: trips.ownerUserId, title: trips.title })
      .from(trips)
      .where(and(eq(trips.tgLinkCode, code.toUpperCase()), gt(trips.tgLinkExpires, new Date())))
      .for("update");
    if (!t || !t.owner) return { ok: false, error: "bad_code" };
    const ownerTg = await getTelegramId(t.owner);
    if (!ownerTg || String(senderTelegramId) !== ownerTg) return { ok: false, error: "not_organizer" };
    const [taken] = await tx.select({ id: trips.id }).from(trips).where(eq(trips.tgChatId, chatId));
    if (taken && taken.id !== t.id) return { ok: false, error: "chat_taken" };
    await tx
      .update(trips)
      .set({ tgChatId: chatId, tgChatTitle: chatTitle.slice(0, 120), tgLinkCode: null, tgLinkExpires: null })
      .where(eq(trips.id, t.id));
    return { ok: true, tripTitle: t.title };
  });
}

/** Queue one message for the trip's Telegram group (if it has one). The worker delivers it. */
export async function queueGroupPost(
  tx: DbOrTx,
  tripId: string,
  kind: "pin" | "poll" | "update",
  text: string,
  link: string | null,
) {
  await tx.execute(
    // the notification belongs to the organizer (a row needs a person); "chatId" redirects it to the group
    sqlPost(tripId, kind, text.slice(0, 300), link),
  );
}

const sqlPost = (tripId: string, kind: string, text: string, link: string | null) => sql`
  insert into notifications (user_id, type, payload, channel)
  select t.owner_user_id, 'group_post',
    jsonb_build_object('tripId', t.id::text, 'chatId', t.tg_chat_id, 'kind', ${kind}::text, 'text', ${text}::text, 'link', ${link}::text),
    'telegram'
  from trips t where t.id = ${tripId} and t.tg_chat_id is not null and t.owner_user_id is not null`;

/** t.me link that opens the trip in the Mini App (for the button under group posts). */
export async function shareLink(tx: DbOrTx, tripId: string) {
  const bot = process.env.TELEGRAM_BOT_USERNAME;
  const [t] = await tx.select({ code: trips.publicCode }).from(trips).where(eq(trips.id, tripId));
  return bot && t?.code ? `https://t.me/${bot}?startapp=trip_${t.code}` : null;
}

/** A personal, single-use invite to the group for an approved member (valid one day). */
export async function memberInvite(userId: string, tripId: string) {
  const st = await groupStatus(userId, tripId);
  if (!st?.linked) return { ok: false as const, error: "not_linked" as const };
  const [t] = await getDb().select({ chat: trips.tgChatId }).from(trips).where(eq(trips.id, tripId));
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!t?.chat || !token) return { ok: false as const, error: "unavailable" as const };
  const root = (process.env.TELEGRAM_API_ROOT || "https://api.telegram.org").replace(/\/$/, "");
  const res = await fetch(`${root}/bot${token}/createChatInviteLink`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: t.chat,
      member_limit: 1,
      expires_date: Math.floor(Date.now() / 1000) + 86_400,
    }),
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  const data = (await res?.json().catch(() => null)) as {
    ok?: boolean;
    result?: { invite_link?: string };
  } | null;
  // the bot must be an administrator who may invite; otherwise Telegram refuses
  return data?.ok && data.result?.invite_link
    ? { ok: true as const, link: data.result.invite_link }
    : { ok: false as const, error: "bot_not_admin" as const };
}
