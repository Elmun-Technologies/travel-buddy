import "server-only";
import { randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import {
  familyLinks,
  notifications,
  planItems,
  safetyEvents,
  travelerProfiles,
  tripMembers,
  trips,
  trustedContacts,
  users,
} from "@/db/schema";
import { mainNumber } from "@/lib/emergency";
import { getDb } from "@/lib/db";
import { getTelegramId } from "@/modules/auth/service";
import { getVisaRule } from "@/modules/destinations/service";
import { getMyMembership } from "@/modules/groups/service";
import { getReliability } from "@/modules/reliability/service";

const token = () => randomBytes(18).toString("base64url");

/** Safety actions are for people actually in the group. */
export async function isApprovedMember(userId: string, tripId: string) {
  return (await getMyMembership(userId, tripId))?.status === "approved";
}

// ---------- trusted contacts ----------

export async function listContacts(userId: string) {
  return getDb()
    .select({
      id: trustedContacts.id,
      name: trustedContacts.name,
      token: trustedContacts.token,
      linked: sql<boolean>`${trustedContacts.chatId} is not null`,
    })
    .from(trustedContacts)
    .where(eq(trustedContacts.userId, userId))
    .orderBy(trustedContacts.createdAt);
}

export async function addContact(userId: string, name: string) {
  const [{ n }] = await getDb()
    .select({ n: count() })
    .from(trustedContacts)
    .where(eq(trustedContacts.userId, userId));
  if (n >= 5) return null;
  const [c] = await getDb()
    .insert(trustedContacts)
    .values({ userId, name, token: token() })
    .returning({ id: trustedContacts.id, token: trustedContacts.token });
  return c;
}

export async function removeContact(userId: string, id: string) {
  await getDb()
    .delete(trustedContacts)
    .where(and(eq(trustedContacts.id, id), eq(trustedContacts.userId, userId)));
}

/** The contact opened t.me/<bot>?start=trust_<token>. Returns the traveler's name, or null. */
export async function acceptContact(tok: string, chatId: string) {
  const [c] = await getDb()
    .update(trustedContacts)
    .set({ chatId })
    .where(eq(trustedContacts.token, tok))
    .returning({ userId: trustedContacts.userId });
  if (!c) return null;
  const [p] = await getDb()
    .select({ name: travelerProfiles.displayName })
    .from(travelerProfiles)
    .where(eq(travelerProfiles.userId, c.userId));
  return p?.name ?? "";
}

// ---------- check-in, SOS, location ----------

type Point = { lat: number; lng: number } | null;

/**
 * "Hammasi joyida" → trusted contacts. SOS → the whole group and trusted contacts, always
 * (cannot be turned off). Location → visible on the family page for one hour.
 */
export async function recordSafety(
  userId: string,
  tripId: string,
  kind: "checkin" | "sos" | "location" | "location_off",
  at: Point,
) {
  const db = getDb();
  await db.transaction(async (tx) => {
    if (kind === "location_off") {
      await tx
        .update(safetyEvents)
        .set({ expiresAt: new Date() })
        .where(
          and(
            eq(safetyEvents.userId, userId),
            eq(safetyEvents.tripId, tripId),
            eq(safetyEvents.kind, "location"),
            gt(safetyEvents.expiresAt, new Date()),
          ),
        );
      return;
    }
    await tx.insert(safetyEvents).values({
      userId,
      tripId,
      kind,
      lat: at?.lat ?? null,
      lng: at?.lng ?? null,
      expiresAt: kind === "location" ? new Date(Date.now() + 3600_000) : null,
    });
    if (kind === "location") return;
    const payload = {
      tripId,
      memberId: userId,
      ...(at ? { lat: at.lat.toFixed(5), lng: at.lng.toFixed(5) } : {}),
    };
    const contacts = await tx
      .select({ chatId: trustedContacts.chatId })
      .from(trustedContacts)
      .where(and(eq(trustedContacts.userId, userId), isNotNull(trustedContacts.chatId)));
    const type = kind === "sos" ? "sos_contact" : "checkin_contact";
    if (contacts.length)
      await tx.insert(notifications).values(
        contacts.map((c) => ({
          userId,
          type,
          payload: { ...payload, chatId: c.chatId! },
          channel: "telegram",
        })),
      );
    if (kind === "sos") {
      // Everyone else in the group, blocked or not: an emergency overrides blocks and settings.
      await tx.execute(sql`
        insert into notifications (user_id, type, payload, channel)
        select tm.user_id, 'sos', ${JSON.stringify(payload)}::jsonb, 'telegram'
        from trip_members tm
        where tm.trip_id = ${tripId} and tm.status = 'approved' and tm.user_id <> ${userId}`);
    }
  });
}

/** What the SOS page shows: contacts, latest check-in, active location share, group size. */
export async function getSafety(userId: string, tripId: string) {
  const db = getDb();
  const [contacts, last, location, [{ n }]] = await Promise.all([
    listContacts(userId),
    db
      .select({ at: safetyEvents.createdAt })
      .from(safetyEvents)
      .where(
        and(
          eq(safetyEvents.userId, userId),
          eq(safetyEvents.tripId, tripId),
          eq(safetyEvents.kind, "checkin"),
        ),
      )
      .orderBy(desc(safetyEvents.createdAt))
      .limit(1),
    db
      .select({ until: safetyEvents.expiresAt })
      .from(safetyEvents)
      .where(
        and(
          eq(safetyEvents.userId, userId),
          eq(safetyEvents.tripId, tripId),
          eq(safetyEvents.kind, "location"),
          gt(safetyEvents.expiresAt, new Date()),
        ),
      )
      .limit(1),
    db
      .select({ n: count() })
      .from(tripMembers)
      .where(and(eq(tripMembers.tripId, tripId), eq(tripMembers.status, "approved"))),
  ]);
  return {
    contacts: contacts.map(({ id, name, token: t, linked }) => ({ id, name, token: t, linked })),
    lastCheckin: last[0]?.at.toISOString() ?? null,
    sharingUntil: location[0]?.until?.toISOString() ?? null,
    groupSize: n,
  };
}

// ---------- family page ----------

export async function getFamilyToken(userId: string, tripId: string) {
  const [l] = await getDb()
    .select({ token: familyLinks.token })
    .from(familyLinks)
    .where(
      and(eq(familyLinks.userId, userId), eq(familyLinks.tripId, tripId), isNull(familyLinks.revokedAt)),
    );
  return l?.token ?? null;
}

export async function createFamilyLink(userId: string, tripId: string) {
  const existing = await getFamilyToken(userId, tripId);
  if (existing) return existing;
  const [l] = await getDb()
    .insert(familyLinks)
    .values({ userId, tripId, token: token() })
    .returning({ token: familyLinks.token });
  return l.token;
}

export async function revokeFamilyLink(userId: string, tripId: string) {
  await getDb()
    .update(familyLinks)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(familyLinks.userId, userId), eq(familyLinks.tripId, tripId), isNull(familyLinks.revokedAt)),
    );
}

/**
 * App-Family, opened without login. Only what a worried parent needs: who organizes, group size
 * (female/male only if every member agreed to show gender — owner decision 3), plan, check-in,
 * SOS and emergency numbers. No other member's profile.
 */
export async function getFamilyPage(tok: string) {
  const db = getDb();
  const [link] = await db
    .select({ tripId: familyLinks.tripId, userId: familyLinks.userId })
    .from(familyLinks)
    .where(and(eq(familyLinks.token, tok), isNull(familyLinks.revokedAt)));
  if (!link || !(await isApprovedMember(link.userId, link.tripId))) return null;
  const [trip] = await db.select().from(trips).where(eq(trips.id, link.tripId));
  if (!trip) return null;

  const members = await db
    .select({
      userId: tripMembers.userId,
      gender: travelerProfiles.gender,
      showGender: travelerProfiles.showGender,
      phone: users.phoneVerified,
      name: travelerProfiles.displayName,
      telegram: travelerProfiles.telegramVerified,
      id: travelerProfiles.idVerified,
    })
    .from(tripMembers)
    .innerJoin(users, eq(users.id, tripMembers.userId))
    .leftJoin(travelerProfiles, eq(travelerProfiles.userId, tripMembers.userId))
    .where(and(eq(tripMembers.tripId, trip.id), eq(tripMembers.status, "approved")));
  const everyoneShows = members.every((m) => m.showGender && (m.gender === "female" || m.gender === "male"));
  const organizer = members.find((m) => m.userId === trip.ownerUserId);
  const traveler = members.find((m) => m.userId === link.userId);

  const [plan, events, rel, telegramId] = await Promise.all([
    db
      .select({ day: planItems.day, place: planItems.place, note: planItems.note })
      .from(planItems)
      .where(and(eq(planItems.tripId, trip.id), eq(planItems.proposed, false)))
      .orderBy(planItems.day, planItems.createdAt),
    db
      .select({
        kind: safetyEvents.kind,
        at: safetyEvents.createdAt,
        lat: safetyEvents.lat,
        lng: safetyEvents.lng,
        until: safetyEvents.expiresAt,
      })
      .from(safetyEvents)
      .where(
        and(
          eq(safetyEvents.userId, link.userId),
          eq(safetyEvents.tripId, trip.id),
          inArray(safetyEvents.kind, ["checkin", "sos", "location"]),
        ),
      )
      .orderBy(desc(safetyEvents.createdAt))
      .limit(20),
    organizer ? getReliability([organizer.userId]) : new Map<string, { went: number; total: number }>(),
    getTelegramId(link.userId),
  ]);
  const now = Date.now();
  const checkin = events.find((e) => e.kind === "checkin");
  const sos = events.find((e) => e.kind === "sos" && now - e.at.getTime() < 24 * 3600_000);
  const loc = events.find(
    (e) => e.kind === "location" && e.until && e.until.getTime() > now && e.lat != null,
  );

  return {
    travelerName: traveler?.name ?? "",
    telegramId,
    country: trip.destinationCountry,
    city: trip.destinationCity,
    startDate: trip.startDate,
    endDate: trip.endDate,
    datePrecision: trip.datePrecision,
    womenOnly: trip.womenOnly,
    organizer: organizer
      ? {
          name: organizer.name ?? "",
          phone: organizer.phone,
          id: !!organizer.id,
          reliability: rel.get(organizer.userId) ?? null,
        }
      : null,
    size: members.length,
    verified: members.filter((m) => m.phone).length,
    ratio: everyoneShows
      ? {
          female: members.filter((m) => m.gender === "female").length,
          male: members.filter((m) => m.gender === "male").length,
        }
      : null,
    plan,
    checkin: checkin ? { at: checkin.at.toISOString() } : null,
    sos: sos ? { at: sos.at.toISOString(), lat: sos.lat, lng: sos.lng } : null,
    location: loc ? { at: loc.at.toISOString(), lat: loc.lat!, lng: loc.lng! } : null,
    emergency: mainNumber(trip.destinationCountry),
    embassyPhone: (await getVisaRule(trip.destinationCountry))?.embassyPhone ?? null,
  };
}
