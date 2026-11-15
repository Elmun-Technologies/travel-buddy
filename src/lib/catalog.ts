// Fixed option lists. Country/language names come from Intl.DisplayNames (no translation files needed).

export const COUNTRIES = [
  "UZ",
  "GE",
  "TR",
  "KZ",
  "KG",
  "TJ",
  "AZ",
  "AM",
  "RU",
  "AE",
  "SA",
  "QA",
  "EG",
  "TH",
  "MY",
  "ID",
  "VN",
  "CN",
  "KR",
  "JP",
  "IN",
  "LK",
  "MV",
  "IT",
  "FR",
  "ES",
  "DE",
  "CZ",
  "GR",
  "GB",
  "US",
] as const;
export type Country = (typeof COUNTRIES)[number];

export const LANGUAGES = [
  "uz",
  "ru",
  "en",
  "tr",
  "kk",
  "ky",
  "tg",
  "ar",
  "de",
  "fr",
  "es",
  "zh",
  "ko",
  "ja",
  "fa",
  "hi",
  "it",
] as const;

// The 8 styles from the design (onboarding 02/04, trip creation). Migration 0003 mapped the old list.
export const TRAVEL_STYLES = [
  "mountains",
  "beach",
  "city",
  "food",
  "photo",
  "extreme",
  "budget",
  "shopping",
] as const;

export const GROUP_PREFS = ["mixed", "women_only"] as const;
export const BUDGET_BANDS = ["lt300", "300_600", "600_1000", "any"] as const;
/** Upper end of each onboarding budget band, dollars per person ("any" has none). */
export const BAND_MAX: Record<string, number> = { lt300: 300, "300_600": 600, "600_1000": 1000 };
/** Countries offered as one-tap chips in onboarding ("Qayerga borishni orzu qilasiz?"). */
export const POPULAR_DESTINATIONS = [
  "GE",
  "TR",
  "KZ",
  "AE",
  "TH",
  "KG",
  "AZ",
  "EG",
  "MY",
  "ID",
  "VN",
  "UZ",
] as const;

export const INTERESTS = [
  "history",
  "art",
  "music",
  "sport",
  "hiking",
  "diving",
  "skiing",
  "yoga",
  "shopping",
  "cuisine",
  "photography",
  "architecture",
  "festivals",
  "wildlife",
  "reading",
  "cinema",
] as const;

export const ACCOMMODATION = ["any", "hostel", "hotel", "apartment", "guesthouse", "camping"] as const;
export const CURRENCIES = ["USD", "EUR", "UZS"] as const;
export const GENDERS = ["female", "male", "other"] as const;

export function countryName(code: string, locale: string) {
  return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
}

export function languageName(code: string, locale: string) {
  return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
}

/** Today's date (YYYY-MM-DD) in Tashkent — first market; good enough for date validation. */
export function todayISO(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Asia/Tashkent" });
}

export function ageOn(birthDate: string, today = todayISO()) {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export type Option = { value: string; label: string };

// Compute localized names on the server only: browsers may lack ICU data for "uz"
// (labels would differ → hydration mismatch). Pass these lists into client forms.
export const countryOptions = (locale: string): Option[] =>
  COUNTRIES.map((c) => ({ value: c, label: countryName(c, locale) }));
export const languageOptions = (locale: string): Option[] =>
  LANGUAGES.map((l) => ({ value: l, label: languageName(l, locale) }));
