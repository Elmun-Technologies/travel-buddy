import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { authedJson, json } from "@/lib/api";
import { fieldErrors } from "@/lib/form";
import { formatBudget, formatTripDates } from "@/lib/format";
import { rateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/track";
import { bandToBudget, createTripBody, datesFor, tripSchema } from "@/modules/trips/schema";
import { isClubOrganizer } from "@/modules/clubs/service";
import { createTrip } from "@/modules/trips/service";
import { buildTripTitle } from "@/modules/trips/title";

// "Safarni ochamiz" (App-CreateTrip-2). Title, dates and budget are derived here so a trip opens in ~60 s.
export async function POST(req: Request) {
  const r = await authedJson(req, 4_096);
  if (!r.ok) return r.res;
  const { user, body } = r.value;
  const parsed = createTripBody.safeParse(body);
  if (!parsed.success) return json({ errors: fieldErrors(parsed.error) }, 422);
  const b = parsed.data;
  const raw = (body as { locale?: unknown }).locale;
  const locale = routing.locales.find((l) => l === raw) ?? routing.defaultLocale;
  if (!(await rateLimit(`trip:user:${user.id}`, 10, 86_400))) return json({ error: "rate_limited" }, 429);

  const dates = datesFor(b);
  const title = await buildTripTitle(locale, b.country, b.city, dates);
  const [min, max] = bandToBudget(b.band);

  const input = tripSchema.safeParse({
    title,
    destinationCountry: b.country,
    destinationCity: b.city ?? "",
    ...dates,
    dateFlexDays: b.flex ? 2 : 0,
    budgetMin: min,
    budgetMax: max,
    currency: "USD",
    travelStyles: b.styles,
    groupSizeMax: b.size,
    ageMin: null,
    ageMax: null,
    womenOnly: b.womenOnly,
    accommodationPref: "any",
    description: b.note ?? "",
  });
  if (!input.success) return json({ errors: fieldErrors(input.error) }, 422);
  if (b.clubId && !(await isClubOrganizer(user.id, b.clubId))) return json({ error: "forbidden" }, 403);
  const res = await createTrip(user.id, input.data, b.clubId);
  if (!res.ok) return json({ error: res.error }, 409);
  track("trip_created", user.id, { country: b.country, size: b.size, women_only: b.womenOnly });
  const ts = await getTranslations({ locale, namespace: "share" });
  const budget = formatBudget(min == null ? null : min * 100, max == null ? null : max * 100, "USD");
  const meta = [formatTripDates(dates, locale), budget, ts("spots", { n: 1, max: b.size })]
    .filter(Boolean)
    .join(" · ");
  return json({ id: res.id, code: res.code, title, meta });
}
