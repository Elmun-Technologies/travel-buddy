import type { MetadataRoute } from "next";
import { connection } from "next/server";

// Only production is open to search engines (staging and previews must never be indexed).
export default async function robots(): Promise<MetadataRoute.Robots> {
  await connection(); // APP_ENV / APP_URL are runtime values
  if (process.env.APP_ENV !== "production") return { rules: { userAgent: "*", disallow: "/" } };
  const base = process.env.APP_URL?.replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private and personal pages: the app itself, admin, one-off links
      disallow: ["/api/", "/*/admin", "/*/me", "/*/home", "/*/rooms", "/*/f/", "/*/1m", "/*/inbound", "/*/login"],
    },
    ...(base ? { sitemap: `${base}/sitemap.xml` } : {}),
  };
}
