import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { routing } from "@/i18n/routing";
import { COUNTRIES } from "@/lib/catalog";
import { listPublicTripsForSitemap } from "@/modules/trips/service";

// Public pages only: landing, documents, destinations and open trips. Runtime (reads the database).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = (process.env.APP_URL ?? "").replace(/\/$/, "");
  if (!base || process.env.APP_ENV !== "production") return [];
  const langs = (path: string) => ({
    languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`])),
  });
  const entry = (path: string, priority: number, lastModified?: Date) =>
    routing.locales.map((l) => ({
      url: `${base}/${l}${path}`,
      lastModified,
      priority,
      alternates: langs(path),
    }));
  const trips = await listPublicTripsForSitemap(500);
  return [
    ...entry("", 1),
    ...entry("/trips", 0.9),
    ...["/terms", "/privacy", "/safety", "/support"].flatMap((p) => entry(p, 0.3)),
    ...COUNTRIES.flatMap((c) => entry(`/destinations/${c}`, 0.7)),
    ...trips.flatMap((t) => entry(`/trips/${t.id}`, 0.6, t.updatedAt)),
  ];
}
