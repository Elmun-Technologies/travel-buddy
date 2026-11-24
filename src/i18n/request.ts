import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: override }) => {
  const candidate = override ?? (await rootLocale());
  const locale = hasLocale(routing.locales, candidate) ? candidate : routing.defaultLocale;
  // Long legal texts live in their own files (messages/legal/<locale>.json) under the "legal" namespace.
  const [main, legal] = await Promise.all([
    import(`../../messages/${locale}.json`),
    import(`../../messages/legal/${locale}.json`),
  ]);
  return {
    locale,
    messages: { ...main.default, legal: legal.default },
  };
});
