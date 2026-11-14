import "server-only";
import { and, eq } from "drizzle-orm";
import { authAccounts } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  createUser,
  getLocale,
  getUserState,
  markPhoneVerified,
  type PhoneResult,
  setLocale,
} from "@/modules/users/service";
import type { TelegramUser } from "./telegram";

export type LoginResult = { ok: true; userId: string; isNew: boolean } | { ok: false; error: "suspended" };

/** Finds or creates the user behind a verified Telegram identity. */
export async function loginWithTelegram(tg: TelegramUser, locale: string): Promise<LoginResult> {
  return getDb().transaction(async (tx) => {
    const [acc] = await tx
      .select({ userId: authAccounts.userId })
      .from(authAccounts)
      .where(and(eq(authAccounts.provider, "telegram"), eq(authAccounts.providerUserId, String(tg.id))));
    if (acc) {
      const state = await getUserState(tx, acc.userId);
      if (state?.status !== "active") return { ok: false, error: "suspended" };
      return { ok: true, userId: acc.userId, isNew: false };
    }
    const userId = await createUser(tx, locale);
    await tx.insert(authAccounts).values({ userId, provider: "telegram", providerUserId: String(tg.id) });
    return { ok: true, userId, isNew: true };
  });
}

export async function hasTelegram(userId: string) {
  const [row] = await getDb()
    .select({ id: authAccounts.id })
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.provider, "telegram")));
  return !!row;
}

/** Called by the bot after request_contact; the contact must belong to the sender. */
export async function verifyPhoneFromTelegram(
  telegramId: number,
  phone: string,
): Promise<PhoneResult | "no_user"> {
  const [acc] = await getDb()
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "telegram"), eq(authAccounts.providerUserId, String(telegramId))));
  if (!acc) return "no_user";
  return markPhoneVerified(acc.userId, phone);
}

async function userIdByTelegram(telegramId: number) {
  const [acc] = await getDb()
    .select({ userId: authAccounts.userId })
    .from(authAccounts)
    .where(and(eq(authAccounts.provider, "telegram"), eq(authAccounts.providerUserId, String(telegramId))));
  return acc?.userId ?? null;
}

/** App language of the person behind a Telegram account (null if they never opened the app). */
export async function getTelegramLocale(telegramId: number) {
  const userId = await userIdByTelegram(telegramId);
  return userId ? getLocale(userId) : null;
}

/** Language chosen in the bot ("Tilni tanlash"); the app uses it too for that account. */
export async function setTelegramLocale(telegramId: number, locale: string) {
  const userId = await userIdByTelegram(telegramId);
  if (userId) await setLocale(userId, locale);
}
