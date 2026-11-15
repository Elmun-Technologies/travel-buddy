import "server-only";
import { BAND_MAX, ageOn } from "@/lib/catalog";
import { getMatchProfiles, getOwnProfile } from "@/modules/profiles/service";
import { listMyIntents, type TripCard } from "@/modules/trips/service";
import { type Factor, matchTrip, type Traveler } from "./score";

export type Match = { percent: number | null; reasons: Factor[] };

/** The traveler as matching sees them: profile answers plus their "sherik izlayapman" intents. */
export async function travelerFor(userId: string): Promise<Traveler | null> {
  const [p, intents] = await Promise.all([getOwnProfile(userId), listMyIntents(userId)]);
  if (!p) return null;
  const band = BAND_MAX[p.budgetBand ?? ""];
  return {
    age: ageOn(p.birthDate),
    gender: p.gender,
    countries: [...new Set([...p.dreamDestinations, ...intents.map((i) => i.destinationCountry)])],
    windows: intents.map((i) => ({ start: i.startDate, end: i.endDate })),
    budgetMax: band ? band * 100 : null,
    styles: p.travelStyles,
    interests: p.interests,
    languages: p.languages,
  };
}

/** Score feed trips for a traveler: hard-filtered ones are dropped, the rest sorted best first. */
export async function rankTrips(traveler: Traveler, trips: TripCard[]) {
  const organizers = await getMatchProfiles([
    ...new Set(trips.flatMap((t) => (t.ownerUserId ? [t.ownerUserId] : []))),
  ]);
  return trips
    .map((t) => ({
      trip: t,
      match: matchTrip(traveler, {
        country: t.destinationCountry,
        startDate: t.startDate,
        endDate: t.endDate,
        flexDays: t.dateFlexDays,
        budgetMin: t.budgetMin,
        budgetMax: t.budgetMax,
        styles: t.travelStyles,
        ageMin: t.ageMin,
        ageMax: t.ageMax,
        womenOnly: t.womenOnly,
        organizer: t.ownerUserId ? (organizers.get(t.ownerUserId) ?? null) : null,
      }),
    }))
    .filter((x): x is { trip: TripCard; match: Match } => x.match !== null)
    .sort((a, b) => (b.match.percent ?? -1) - (a.match.percent ?? -1));
}
