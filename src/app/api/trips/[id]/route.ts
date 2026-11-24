import { z } from "zod";
import { routing } from "@/i18n/routing";
import { authedJson, json } from "@/lib/api";
import { fieldErrors } from "@/lib/form";
import { rateLimit } from "@/lib/rate-limit";
import { bandToBudget, datesFor, tripSchema, updateTripBody } from "@/modules/trips/schema";
import { getTripView, updateTrip } from "@/modules/trips/service";
import { buildTripTitle } from "@/modules/trips/title";

// "Safarni tahrirlash": the organizer changes dates, size, budget, styles, women-only and the note.
export async function PATCH(req: Request, { params }: RouteContext<"/api/trips/[id]">) {
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) return json({ error: "not_found" }, 404);
  const r = await authedJson(req, 4_096);
  if (!r.ok) return r.res;
  const { user, body } = r.value;
  const parsed = updateTripBody.safeParse(body);
  if (!parsed.success) return json({ errors: fieldErrors(parsed.error) }, 422);
  if (!(await rateLimit(`tripedit:user:${user.id}`, 30, 86_400))) return json({ error: "rate_limited" }, 429);

  const b = parsed.data;
  const raw = (body as { locale?: unknown }).locale;
  const locale = routing.locales.find((l) => l === raw) ?? routing.defaultLocale;
  const trip = await getTripView(id.data, user.id);
  if (!trip?.isOwner) return json({ error: "forbidden" }, 403);

  // The same derivation as when the trip was opened: title, dates and budget from the choices.
  const dates = datesFor({ ...b, country: "UZ" });
  const title = await buildTripTitle(locale, trip.destinationCountry, trip.destinationCity, dates);
  const [min, max] = bandToBudget(b.band);
  const input = tripSchema.safeParse({
    title,
    destinationCountry: trip.destinationCountry,
    destinationCity: trip.destinationCity ?? "",
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
  const d = input.data;
  const res = await updateTrip(user.id, id.data, {
    title: d.title,
    startDate: d.startDate,
    endDate: d.endDate,
    datePrecision: d.datePrecision,
    dateFlexDays: d.dateFlexDays,
    budgetMin: d.budgetMin,
    budgetMax: d.budgetMax,
    travelStyles: d.travelStyles,
    groupSizeMax: d.groupSizeMax,
    womenOnly: d.womenOnly,
    description: d.description,
  });
  if (!res.ok) return json({ error: res.error }, res.error === "forbidden" ? 403 : 409);
  return json({ ok: true });
}
