// Licensed destination photos (public/photos, see CREDITS.md). Until organisers upload their own (4b),
// a trip card shows its country's photo — never a person's portrait.
const COUNTRY_PHOTO: Record<string, string> = {
  GE: "gergeti",
  TR: "istanbul-galata",
  KZ: "almaty",
  AE: "dubai",
  UZ: "samarkand",
};

export const FEATURED_COUNTRIES = ["GE", "TR", "KZ", "AE", "UZ"] as const;

export function countryPhoto(country: string, size: 400 | 1200 = 1200) {
  return `/photos/${COUNTRY_PHOTO[country] ?? "hike-group"}-${size}.webp`;
}
