// Staging/development sample trips (worker/seed.ts) have fixed ids with this prefix.
// Only these show the "Namuna" tag: real test trips created on staging are not illustrations.
export const SAMPLE_TRIP_PREFIX = "00000000-0000-4000-8000-0000000002";
export const isSampleTrip = (id: string) => id.startsWith(SAMPLE_TRIP_PREFIX);
