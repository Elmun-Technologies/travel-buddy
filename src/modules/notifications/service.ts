import "server-only";
import { notifications } from "@/db/schema";
import type { DbOrTx } from "@/lib/db";

export type NotificationType = "join_requested" | "join_approved";

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
