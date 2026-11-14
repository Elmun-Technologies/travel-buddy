// Local emergency numbers per destination (App-SOS, App-Family). Static content, checked 2026-11-14;
// re-check before launch and when adding a country. One number = a single emergency line;
// otherwise police and ambulance are listed separately.

export type Emergency = { all: string } | { police: string; ambulance: string };

const ONE = (n: string): Emergency => ({ all: n });
const TWO = (police: string, ambulance: string): Emergency => ({ police, ambulance });

export const EMERGENCY: Record<string, Emergency> = {
  UZ: TWO("102", "103"),
  GE: ONE("112"),
  TR: ONE("112"),
  KZ: ONE("112"),
  KG: ONE("112"),
  TJ: TWO("102", "103"),
  AZ: ONE("112"),
  AM: ONE("911"),
  RU: ONE("112"),
  AE: TWO("999", "998"),
  SA: ONE("911"),
  QA: ONE("999"),
  EG: TWO("122", "123"),
  TH: TWO("1155", "1669"),
  MY: ONE("999"),
  ID: ONE("112"),
  VN: TWO("113", "115"),
  CN: TWO("110", "120"),
  KR: TWO("112", "119"),
  JP: TWO("110", "119"),
  IN: ONE("112"),
  LK: TWO("119", "1990"),
  MV: TWO("119", "102"),
  IT: ONE("112"),
  FR: ONE("112"),
  ES: ONE("112"),
  DE: ONE("112"),
  CZ: ONE("112"),
  GR: ONE("112"),
  GB: ONE("999"),
  US: ONE("911"),
};

/** The one number to show first (single line, or police). */
export const mainNumber = (country: string) => {
  const e = EMERGENCY[country];
  return e ? ("all" in e ? e.all : e.police) : null;
};
