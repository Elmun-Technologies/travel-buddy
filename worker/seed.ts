// Sample trips for staging/development ("Namuna" on every card). NEVER runs in production:
// the guard below refuses unless APP_ENV is staging or development. Idempotent (fixed ids, upserts);
// dates are recomputed from today on every run so the samples always lie in the future.
import { sql } from "drizzle-orm";
import {
  priceStats,
  travelerProfiles,
  tripMembers,
  trips,
  users,
  visaAgencies,
  visaRules,
} from "@/db/schema";
import { todayISO } from "@/lib/catalog";
import type { Db } from "@/lib/db";
import { SAMPLE_TRIP_PREFIX } from "@/lib/sample";

export const SEED_ENVS = ["staging", "development"];

const uid = (n: number) => `00000000-0000-4000-8000-0000000001${String(n).padStart(2, "0")}`;
const tid = (n: number) => `${SAMPLE_TRIP_PREFIX}${String(n).padStart(2, "0")}`;

const people = [
  ["Akmal", "male", "1997-04-12", ["mountains", "city"]],
  ["Dilnoza", "female", "1999-08-03", ["photo", "city"]],
  ["Sardor", "male", "1995-01-25", ["city", "shopping"]],
  ["Malika", "female", "2000-06-17", ["mountains", "beach"]],
  ["Jasur", "male", "1993-11-09", ["budget", "extreme"]],
  ["Nilufar", "female", "1998-02-21", ["beach", "food"]],
  ["Bekzod", "male", "1996-09-30", ["extreme", "photo"]],
  ["Kamola", "female", "2001-03-14", ["mountains", "food"]],
  ["Timur", "male", "1994-12-05", ["city", "shopping"]],
  ["Zarina", "female", "1997-07-28", ["beach", "budget"]],
] as const;

// [owner, country, city, title, start in days, length, budget $min–max, styles, group size, approved, women only]
const samples = [
  [0, "GE", "Tbilisi", "Tbilisi va Kazbegi", 12, 7, 550, 650, ["mountains", "city"], 10, 7, false],
  [5, "GE", "Batumi", "Batumi · dengiz", 40, 5, 400, 550, ["beach"], 8, 2, false],
  [2, "TR", "Istanbul", "Istanbul · 5 kun", 28, 5, 450, 600, ["city", "shopping"], 6, 3, false],
  [1, "TR", "Kapadokya", "Kapadokya · havo sharlari", 55, 4, 500, 700, ["photo", "extreme"], 8, 4, false],
  [3, "KZ", "Olmaota", "Olmaota tog'lari", 20, 5, 300, 400, ["mountains"], 8, 4, true],
  [4, "KZ", "Olmaota", "Olmaota · shahar va ko'l", 75, 4, 250, 350, ["budget", "city"], 6, 2, false],
  [8, "AE", "Dubay", "Dubay · Yangi yil", 45, 6, 900, 1200, ["city", "shopping"], 12, 9, false],
  [6, "AE", "Dubay", "Dubay · cho'l safari", 85, 4, 700, 900, ["extreme", "photo"], 6, 1, false],
  [0, "GE", "Gudauri", "Gudauri · chang'i", 60, 6, 600, 800, ["extreme", "mountains"], 8, 3, false],
  [9, "TR", "Antaliya", "Antaliya · dengiz", 100, 7, 500, 700, ["beach", "budget"], 10, 2, false],
] as const;

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export async function seedSamples(db: Db, env = process.env.APP_ENV) {
  if (!env || !SEED_ENVS.includes(env)) throw new Error(`seed refused: APP_ENV=${env ?? "unset"}`);
  const today = todayISO();

  await db.transaction(async (tx) => {
    for (const [i, [name, gender, birthDate, styles]] of people.entries()) {
      await tx
        .insert(users)
        .values({ id: uid(i), locale: "uz" })
        .onConflictDoNothing();
      const profile = {
        displayName: name,
        birthDate,
        gender,
        showGender: true,
        city: "Toshkent",
        country: "UZ",
        languages: ["uz", "ru"],
        travelStyles: [...styles],
        bio: "Namunaviy profil (staging).",
        telegramVerified: true,
      };
      await tx
        .insert(travelerProfiles)
        .values({ userId: uid(i), ...profile })
        .onConflictDoUpdate({ target: travelerProfiles.userId, set: profile });
    }

    for (const [
      n,
      [owner, country, city, title, start, days, min, max, styles, size, approved, womenOnly],
    ] of samples.entries()) {
      const startDate = addDays(today, start);
      const trip = {
        kind: "independent" as const,
        ownerUserId: uid(owner),
        title,
        destinationCountry: country,
        destinationCity: city,
        startDate,
        endDate: addDays(startDate, days - 1),
        dateFlexDays: 2,
        budgetMin: min * 100,
        budgetMax: max * 100,
        currency: "USD",
        travelStyles: [...styles],
        groupSizeMax: size,
        ageMin: 18,
        ageMax: 40,
        womenOnly,
        description: `Namunaviy safar (staging). ${days} kun, ${city}. Reja va kelishuvlar guruh bilan birga tuziladi.`,
        status: "open" as const,
        isTest: true,
        publicCode: `NAMUNA${n}`,
      };
      await tx
        .insert(trips)
        .values({ id: tid(n), ...trip })
        .onConflictDoUpdate({ target: trips.id, set: trip });

      // Organizer + (approved - 1) members; women-only trips get only women.
      const others = people
        .map((p, i) => ({ i, gender: p[1] }))
        .filter((p) => p.i !== owner && (!womenOnly || p.gender === "female"))
        .slice(0, approved - 1);
      for (const m of [
        { i: owner, role: "organizer" as const },
        ...others.map((o) => ({ i: o.i, role: "member" as const })),
      ]) {
        await tx
          .insert(tripMembers)
          .values({ tripId: tid(n), userId: uid(m.i), role: m.role, status: "approved" })
          .onConflictDoUpdate({
            target: [tripMembers.tripId, tripMembers.userId],
            set: { role: m.role, status: "approved" },
          });
      }
    }
  });
  await seedDestinationSamples(db);
  const [{ n }] = await db.execute<{ n: number }>(sql`select count(*)::int as n from trips where is_test`);
  return n;
}

// Visa / price / agency samples so the 5b screens can be checked on staging. All marked is_sample
// ("Namuna"); real rows entered in admin are never overwritten (insert … on conflict do nothing).
const usd = (n: number) => n * 100;
async function seedDestinationSamples(db: Db) {
  const checkedAt = todayISO();
  await db
    .insert(visaRules)
    .values([
      {
        destination: "GE",
        status: "visa_free",
        maxStayDays: 365,
        notes: "faqat pasport",
        checkedAt,
        isSample: true,
      },
      {
        destination: "TR",
        status: "visa_free",
        maxStayDays: 30,
        notes: "pasport 150+ kun amal qilsin",
        checkedAt,
        isSample: true,
      },
      { destination: "KZ", status: "visa_free", maxStayDays: 30, checkedAt, isSample: true },
      {
        destination: "AE",
        status: "evisa",
        maxStayDays: 30,
        notes: "chegarada tekshiruv qattiq",
        documents: ["Pasport", "Rangli foto", "Mehmonxona broni", "Qaytish chiptasi"],
        checkedAt,
        isSample: true,
      },
      {
        destination: "DE",
        status: "visa_required",
        visaName: "Shengen vizasi",
        documents: [
          "Pasport — qaytgandan keyin ham amal qilsin",
          "Rangli foto, biometrik o'lcham",
          "Bank ko'chirmasi",
          "Tibbiy sug'urta (Shengen talabiga mos)",
          "Mehmonxona va chipta broni",
        ],
        checkedAt,
        isSample: true,
      },
    ])
    .onConflictDoNothing();
  await db
    .insert(visaAgencies)
    .values([
      {
        id: uid(90),
        name: "Visa Point",
        countries: ["DE", "AE"],
        rating: 4.8,
        priceMinor: usd(60),
        note: "hujjatlarni tekshiradi",
        isSample: true,
      },
      {
        id: uid(91),
        name: "Euro Visa Center",
        countries: ["DE"],
        rating: 4.6,
        priceMinor: usd(75),
        note: "yozilish + tarjima",
        isSample: true,
      },
    ])
    .onConflictDoNothing();
  const items = (flight: number, stay: number, food: number, transport: number, tours: number) => [
    { key: "flight", amount: usd(flight) },
    { key: "stay", amount: usd(stay) },
    { key: "food", amount: usd(food) },
    { key: "transport", amount: usd(transport) },
    { key: "tours", amount: usd(tours) },
  ];
  await db
    .insert(priceStats)
    .values([
      {
        destination: "GE",
        days: 7,
        roomType: "quad",
        p25: usd(520),
        median: usd(585),
        p75: usd(650),
        items: items(210, 105, 140, 60, 70),
        isSample: true,
      },
      {
        destination: "GE",
        days: 7,
        roomType: "double",
        p25: usd(590),
        median: usd(655),
        p75: usd(720),
        items: items(210, 175, 140, 60, 70),
        isSample: true,
      },
      {
        destination: "GE",
        days: 7,
        roomType: "single",
        p25: usd(700),
        median: usd(780),
        p75: usd(860),
        items: items(210, 300, 140, 60, 70),
        isSample: true,
      },
      {
        destination: "TR",
        days: 5,
        roomType: "quad",
        p25: usd(450),
        median: usd(520),
        p75: usd(600),
        items: items(240, 90, 110, 40, 40),
        isSample: true,
      },
    ])
    .onConflictDoNothing();
}
