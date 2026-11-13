import "server-only";
import { eq, inArray } from "drizzle-orm";
import { travelerProfiles } from "@/db/schema";
import { ageOn } from "@/lib/catalog";
import { getDb } from "@/lib/db";
import { hasTelegram } from "@/modules/auth/service";
import { isBlockedBetween } from "@/modules/moderation/service";
import { getPhoneVerified } from "@/modules/users/service";
import type { ProfileInput } from "./schema";

export async function getOwnProfile(userId: string) {
  const [p] = await getDb().select().from(travelerProfiles).where(eq(travelerProfiles.userId, userId));
  return p ?? null;
}

export async function saveProfile(userId: string, input: ProfileInput) {
  const telegramVerified = await hasTelegram(userId);
  await getDb()
    .insert(travelerProfiles)
    .values({ userId, ...input, telegramVerified })
    .onConflictDoUpdate({ target: travelerProfiles.userId, set: { ...input, telegramVerified } });
}

/** Display names for a set of users (trip cards, member lists). */
export async function getDisplayNames(userIds: string[]) {
  if (!userIds.length) return new Map<string, string>();
  const rows = await getDb()
    .select({ id: travelerProfiles.userId, name: travelerProfiles.displayName })
    .from(travelerProfiles)
    .where(inArray(travelerProfiles.userId, userIds));
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** What other users may see. Never phone, never exact birth date; gender only if opted in. */
export async function getPublicProfile(viewerId: string, userId: string) {
  if (viewerId !== userId && (await isBlockedBetween(viewerId, userId))) return null;
  const p = await getOwnProfile(userId);
  if (!p) return null;
  const phone = (await getPhoneVerified([userId])).get(userId) ?? false;
  return {
    userId,
    displayName: p.displayName,
    age: ageOn(p.birthDate),
    gender: p.showGender ? p.gender : null,
    city: p.city,
    country: p.country,
    languages: p.languages,
    travelStyles: p.travelStyles,
    interests: p.interests,
    bio: p.bio,
    verified: { telegram: p.telegramVerified, phone, id: p.idVerified },
  };
}

/** Fields needed for join eligibility. */
export async function getJoinProfile(userId: string) {
  const [p] = await getDb()
    .select({ birthDate: travelerProfiles.birthDate, gender: travelerProfiles.gender })
    .from(travelerProfiles)
    .where(eq(travelerProfiles.userId, userId));
  return p ?? null;
}
