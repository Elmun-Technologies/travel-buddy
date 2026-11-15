// Static facts for App-Destination: licensed photos we have (public/photos, CREDITS.md), what a
// destination is good for, and the usual flight time from Tashkent. Approximate on purpose ("≈"):
// it is a hint for choosing, not a timetable. Countries without facts still get a page.

type Facts = { hero?: string; gallery: string[]; styles: string[]; flightHours?: number };

export const DESTINATIONS: Record<string, Facts> = {
  GE: {
    hero: "kazbek",
    gallery: ["tbilisi-city", "batumi", "kazbek"],
    styles: ["mountains", "food", "city"],
    flightHours: 3,
  },
  TR: { gallery: ["istanbul-galata", "cappadocia"], styles: ["city", "beach", "shopping"], flightHours: 5 },
  KZ: { gallery: ["almaty"], styles: ["mountains", "budget"], flightHours: 1.5 },
  AE: { gallery: ["dubai"], styles: ["city", "shopping", "beach"], flightHours: 3.5 },
  UZ: { gallery: ["samarkand"], styles: ["city", "food", "photo"] },
};

export const destinationFacts = (country: string): Facts =>
  DESTINATIONS[country] ?? { gallery: [], styles: [] };
