// Licensed destination photos (public/photos, see CREDITS.md). Until organisers upload their own (4b),
// a trip card shows its country's photo — never a person's portrait.
const COUNTRY_PHOTO: Record<string, string> = {
  GE: "gergeti",
  TR: "istanbul-galata",
  KZ: "almaty",
  AE: "dubai",
  UZ: "samarkand",
};

// A closer match when the trip's city has its own licensed photo.
const CITY_PHOTO: Record<string, string> = {
  batumi: "batumi",
  tbilisi: "gergeti",
  gudauri: "kazbek",
  kazbegi: "kazbek",
  kapadokya: "cappadocia",
  cappadocia: "cappadocia",
  istanbul: "istanbul-galata",
  olmaota: "almaty",
  almaty: "almaty",
  dubay: "dubai",
  dubai: "dubai",
  samarqand: "samarkand",
};

export const FEATURED_COUNTRIES = ["GE", "TR", "KZ", "AE", "UZ"] as const;

export function photoName(country: string, city?: string | null) {
  return (city && CITY_PHOTO[city.trim().toLowerCase()]) || COUNTRY_PHOTO[country] || "hike-group";
}

export function countryPhoto(country: string, size: 400 | 1200 = 1200, city?: string | null) {
  return `/photos/${photoName(country, city)}-${size}.webp`;
}
