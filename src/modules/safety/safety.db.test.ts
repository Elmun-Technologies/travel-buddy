import { and, eq, inArray } from "drizzle-orm";
import { afterAll, expect, it } from "vitest";
import { notifications, travelerProfiles, tripMembers, trips, users } from "@/db/schema";
import { getDb } from "@/lib/db";
import {
  acceptContact,
  addContact,
  createFamilyLink,
  getFamilyPage,
  recordSafety,
  revokeFamilyLink,
} from "./service";

const run = !!process.env.DATABASE_URL;
const made: string[] = [];

afterAll(async () => {
  if (!run) return;
  await getDb().delete(trips).where(inArray(trips.ownerUserId, made));
  await getDb().delete(users).where(inArray(users.id, made));
});

it.runIf(run)("family page, gender ratio consent, SOS to group and trusted contacts", async () => {
  const db = getDb();
  const person = async (name: string, gender: "female" | "male", showGender: boolean) => {
    const [u] = await db
      .insert(users)
      .values({ locale: "uz", notifyOff: ["mine", "pin", "poll", "chat"] })
      .returning();
    await db
      .insert(travelerProfiles)
      .values({ userId: u.id, displayName: name, birthDate: "1998-01-01", gender, showGender });
    made.push(u.id);
    return u.id;
  };
  const org = await person("Akmal", "male", true);
  const dil = await person("Dilnoza", "female", true);
  const sar = await person("Sardor", "male", false); // doesn't show gender
  const [trip] = await db
    .insert(trips)
    .values({
      kind: "independent",
      ownerUserId: org,
      title: "TEST safety",
      destinationCountry: "GE",
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      status: "open",
      isTest: true,
    })
    .returning({ id: trips.id });
  await db.insert(tripMembers).values([
    { tripId: trip.id, userId: org, role: "organizer", status: "approved" },
    { tripId: trip.id, userId: dil, status: "approved" },
    { tripId: trip.id, userId: sar, status: "approved" },
  ]);

  const tok = await createFamilyLink(dil, trip.id);
  expect(await createFamilyLink(dil, trip.id)).toBe(tok); // one active link
  let page = (await getFamilyPage(tok))!;
  expect(page.travelerName).toBe("Dilnoza");
  expect(page.size).toBe(3);
  expect(page.ratio).toBeNull(); // Sardor didn't agree to show gender → just "3 kishi"
  expect(page.emergency).toBe("112");
  await db.update(travelerProfiles).set({ showGender: true }).where(eq(travelerProfiles.userId, sar));
  page = (await getFamilyPage(tok))!;
  expect(page.ratio).toEqual({ female: 1, male: 2 });

  // Trusted contact links through the bot; SOS reaches them and the group, even with settings off.
  const c = (await addContact(dil, "Onam"))!;
  expect(await acceptContact(c.token, "777")).toBe("Dilnoza");
  expect(await acceptContact("nope", "1")).toBeNull();
  await recordSafety(dil, trip.id, "sos", { lat: 41.7, lng: 44.8 });
  const sent = await db
    .select({ userId: notifications.userId, type: notifications.type, payload: notifications.payload })
    .from(notifications)
    .where(and(inArray(notifications.userId, made), inArray(notifications.type, ["sos", "sos_contact"])));
  expect(
    sent.map((n) => `${n.type}:${n.userId === org ? "org" : n.userId === sar ? "sar" : "dil"}`).sort(),
  ).toEqual(["sos:org", "sos:sar", "sos_contact:dil"]);
  expect(sent.find((n) => n.type === "sos_contact")!.payload).toMatchObject({
    chatId: "777",
    lat: "41.70000",
  });
  expect((await getFamilyPage(tok))!.sos).not.toBeNull();

  await revokeFamilyLink(dil, trip.id);
  expect(await getFamilyPage(tok)).toBeNull();
});
