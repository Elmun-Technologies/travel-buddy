import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["uz", "ru", "en"],
  defaultLocale: "uz",
  localePrefix: "always",
  // "/" always opens /uz (spec: default uz); users switch language in the header.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
