// Traveler ↔ trip match (CLAUDE.md §6). Pure: unit-tested without a database.
// Hard filters first (no score at all), then a weighted score. Factors we know nothing about
// (no dream countries, no dates, no budget…) are left out of the denominator, so "94% mos"
// means "94% of what we can compare" — never padded with guesses.

export const WEIGHTS = {
  destination: 25,
  dates: 20,
  budget: 15,
  styles: 15,
  interests: 10,
  age: 10,
  language: 5,
} as const;
export type Factor = keyof typeof WEIGHTS;

export type Traveler = {
  age: number;
  gender: string | null;
  countries: string[]; // dream destinations + active intents
  windows: { start: string; end: string }[]; // intents' dates
  budgetMax: number | null; // minor units per person
  styles: string[];
  interests: string[];
  languages: string[];
};

export type TripForMatch = {
  country: string;
  startDate: string;
  endDate: string;
  flexDays: number;
  budgetMin: number | null;
  budgetMax: number | null;
  styles: string[];
  ageMin: number | null;
  ageMax: number | null;
  womenOnly: boolean;
  organizer: { age: number; interests: string[]; languages: string[] } | null;
};

const jaccard = (a: string[], b: string[]) => {
  if (!a.length || !b.length) return null;
  const A = new Set(a);
  const inter = b.filter((x) => A.has(x)).length;
  return inter / new Set([...a, ...b]).size;
};
const day = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;

/** null = this trip must not be suggested to this traveler. */
export function matchTrip(u: Traveler, t: TripForMatch) {
  if (t.womenOnly && u.gender !== "female") return null;
  if ((t.ageMin != null && u.age < t.ageMin) || (t.ageMax != null && u.age > t.ageMax)) return null;

  const parts: Partial<Record<Factor, number>> = {}; // 0..1 per factor we can judge
  if (u.countries.length) parts.destination = u.countries.includes(t.country) ? 1 : 0;
  if (u.windows.length) {
    const s = day(t.startDate) - t.flexDays;
    const e = day(t.endDate) + t.flexDays;
    const best = Math.max(
      ...u.windows.map((w) => {
        const overlap = Math.min(e, day(w.end)) - Math.max(s, day(w.start)) + 1;
        return Math.max(0, overlap) / (day(t.endDate) - day(t.startDate) + 1);
      }),
    );
    parts.dates = Math.min(1, best);
  }
  if (u.budgetMax != null && t.budgetMin != null)
    parts.budget =
      t.budgetMin <= u.budgetMax ? 1 : Math.max(0, 1 - (t.budgetMin - u.budgetMax) / u.budgetMax);
  const st = jaccard(u.styles, t.styles);
  if (st != null) parts.styles = Math.min(1, st * 2); // one shared style of two already reads as "mos"
  if (t.organizer) {
    const it = jaccard(u.interests, t.organizer.interests);
    if (it != null) parts.interests = Math.min(1, it * 2);
    parts.age = Math.max(0, 1 - Math.abs(u.age - t.organizer.age) / 15);
    if (u.languages.length && t.organizer.languages.length)
      parts.language = t.organizer.languages.some((l) => u.languages.includes(l)) ? 1 : 0;
  }

  const known = Object.keys(parts) as Factor[];
  const max = known.reduce((s, f) => s + WEIGHTS[f], 0);
  if (max < 25) return { percent: null, reasons: [] as Factor[] }; // too little to say a number
  const got = known.reduce((s, f) => s + WEIGHTS[f] * parts[f]!, 0);
  // "nega mos": strong factors, most important first
  const reasons = known.filter((f) => parts[f]! >= 0.75).sort((a, b) => WEIGHTS[b] - WEIGHTS[a]);
  // ponytail: capped at 99 — we never know everything about a person, "100% mos" would overclaim
  return { percent: Math.min(99, Math.round((got / max) * 100)), reasons };
}
