// "Shu reysni qidiraman": an Aviasales search with route and dates filled in.
// Travelpayouts marker (affiliate) comes from TRAVELPAYOUTS_MARKER; without it the link still works.

const ORIGIN = "TAS"; // ponytail: first market is Tashkent; take it from the profile city when we grow

// Main airport (city code) per destination; cities that have their own airport override it.
const COUNTRY_IATA: Record<string, string> = {
  UZ: "SKD",
  GE: "TBS",
  TR: "IST",
  KZ: "ALA",
  KG: "FRU",
  TJ: "DYU",
  AZ: "BAK",
  AM: "EVN",
  RU: "MOW",
  AE: "DXB",
  SA: "JED",
  QA: "DOH",
  EG: "CAI",
  TH: "BKK",
  MY: "KUL",
  ID: "DPS",
  VN: "SGN",
  CN: "BJS",
  KR: "SEL",
  JP: "TYO",
  IN: "DEL",
  LK: "CMB",
  MV: "MLE",
  IT: "ROM",
  FR: "PAR",
  ES: "BCN",
  DE: "BER",
  CZ: "PRG",
  GR: "ATH",
  GB: "LON",
  US: "NYC",
};
const CITY_IATA: Record<string, string> = {
  batumi: "BUS",
  kutaisi: "KUT",
  antalya: "AYT",
  kapadokya: "NAV",
  cappadocia: "NAV",
  astana: "NQZ",
  bukhara: "BHK",
  buxoro: "BHK",
  khiva: "UGC",
  xiva: "UGC",
  phuket: "HKT",
  "abu dhabi": "AUH",
  sharm: "SSH",
  "sharm el sheikh": "SSH",
  hurghada: "HRG",
  moscow: "MOW",
  "saint petersburg": "LED",
  istanbul: "IST",
  almaty: "ALA",
  tbilisi: "TBS",
  dubai: "DXB",
};

export function destinationIata(country: string, city?: string | null) {
  return (city && CITY_IATA[city.trim().toLowerCase()]) || COUNTRY_IATA[country] || null;
}

const ddmm = (iso: string) => iso.slice(8, 10) + iso.slice(5, 7);

/** Round trip, one passenger: aviasales.uz/search/TAS2011TBS27111?marker=… */
export function flightSearchUrl(
  trip: { destinationCountry: string; destinationCity: string | null; startDate: string; endDate: string },
  marker = process.env.TRAVELPAYOUTS_MARKER,
) {
  const to = destinationIata(trip.destinationCountry, trip.destinationCity);
  if (!to || to === ORIGIN) return null;
  const url = new URL(
    `https://www.aviasales.uz/search/${ORIGIN}${ddmm(trip.startDate)}${to}${ddmm(trip.endDate)}1`,
  );
  if (marker) url.searchParams.set("marker", marker);
  return url.toString();
}
