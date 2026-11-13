import "server-only";
import { waitlist } from "@/db/schema";
import { getDb } from "@/lib/db";
import { waitlistSchema } from "./schema";

export type JoinResult = { ok: true } | { ok: false; error: "invalid" | "rate_limited" | "server" };

export async function joinWaitlist(raw: unknown): Promise<JoinResult> {
  const parsed = waitlistSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { contact, destinations, locale, source } = parsed.data;
  await getDb()
    .insert(waitlist)
    .values({
      contact: contact.value,
      contactType: contact.type,
      destinations,
      locale,
      source,
      isTest: process.env.APP_ENV !== "production",
    })
    // Same contact again = silent success (don't reveal who is on the list).
    .onConflictDoNothing({ target: waitlist.contact });
  return { ok: true };
}
