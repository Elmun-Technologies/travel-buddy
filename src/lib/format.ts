export function flag(country: string) {
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

/** "20-noy" — on the server: browsers (Telegram's WebView too) often lack Uzbek month names. */
export const formatDay = (iso: string, locale: string) =>
  new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(iso));

export function formatDateRange(start: string, end: string, locale: string) {
  const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f.format(new Date(start))} – ${f.format(new Date(end))}`;
}

/** "$550–650", "$300+", "≤ $600": one symbol, no spaces (design style), any currency. */
export function formatBudget(min: number | null, max: number | null, currency: string) {
  if (min == null && max == null) return null;
  const f = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  });
  const n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  if (min != null && max != null) return `${f.format(min / 100)}–${n.format(max / 100)}`;
  return min != null ? `${f.format(min / 100)}+` : `≤ ${f.format(max! / 100)}`;
}

export const botUsername = () => process.env.TELEGRAM_BOT_USERNAME ?? "";

/** Trip dates: "26-noy – 2-dek", or just the month ("dekabr") when the group fixes days later. */
export function formatTripDates(
  t: { startDate: string; endDate: string; datePrecision?: string | null },
  locale: string,
) {
  if (t.datePrecision !== "month") return formatDateRange(t.startDate, t.endDate, locale);
  return new Intl.DateTimeFormat(locale, { month: "long", timeZone: "UTC" }).format(new Date(t.startDate));
}
