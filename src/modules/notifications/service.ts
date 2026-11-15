import "server-only";
import { sql } from "drizzle-orm";
import { notifications } from "@/db/schema";
import type { DbOrTx } from "@/lib/db";

export type NotificationType =
  | "join_requested"
  | "join_approved"
  | "room_pin"
  | "room_poll"
  | "room_digest"
  | "plan_proposed"
  | "settle_received"
  | "ticket_reminder"
  | "ticket_dropped"
  | "spot_freed"
  | "sos"
  | "sos_contact"
  | "checkin_contact"
  | "creator_invite";

/** What the user can turn off in the profile. Everything about them personally is "mine". */
export const NOTIFY_KINDS = ["pin", "poll", "chat", "mine"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];
export const kindOf = (type: string): NotifyKind =>
  type === "room_pin" ? "pin" : type === "room_poll" ? "poll" : type === "room_digest" ? "chat" : "mine";

/**
 * Queue a Telegram message. Written in the caller's transaction (so it exists only if the action
 * committed); the worker delivers it through the bot and sets sent_at.
 */
export async function notify(
  tx: DbOrTx,
  userId: string,
  type: NotificationType,
  payload: Record<string, string>,
) {
  await tx.insert(notifications).values({ userId, type, payload, channel: "telegram" });
}

/** Same message to every current room member except the sender and people blocked either way. */
export async function notifyRoom(
  tx: DbOrTx,
  conversationId: string,
  senderId: string,
  type: "room_pin" | "room_poll",
  payload: Record<string, string>,
) {
  await tx.execute(sql`
    insert into notifications (user_id, type, payload, channel)
    select cm.user_id, ${type}, ${JSON.stringify(payload)}::jsonb, 'telegram'
    from conversation_members cm
    where cm.conversation_id = ${conversationId} and cm.left_at is null and cm.user_id <> ${senderId}
      and not exists (select 1 from blocks b
        where (b.blocker_id = cm.user_id and b.blocked_id = ${senderId})
           or (b.blocker_id = ${senderId} and b.blocked_id = cm.user_id))`);
}
