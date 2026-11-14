export function flag(country: string) {
  return String.fromCodePoint(...[...country.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)));
}

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
