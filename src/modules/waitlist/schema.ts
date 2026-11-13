import { z } from "zod";
import { routing } from "@/i18n/routing";

// Destinations offered on the landing (ISO 3166-1 alpha-2).
export const DESTINATIONS = ["GE", "TR", "KZ", "TH", "AE", "MY", "EG", "KG"] as const;

const TELEGRAM = /^@?[a-zA-Z][a-zA-Z0-9_]{4,31}$/;

export const contactSchema = z
  .string()
  .trim()
  .min(1)
  .max(254)
  .transform((v, ctx) => {
    if (v.includes("@") && !v.startsWith("@")) {
      const email = z.email().safeParse(v.toLowerCase());
      if (email.success) return { type: "email" as const, value: email.data };
    } else if (TELEGRAM.test(v) || /^(https?:\/\/)?t\.me\//.test(v)) {
      const name = v.replace(/^(https?:\/\/)?t\.me\//, "").replace(/^@/, "");
      if (TELEGRAM.test(name)) return { type: "telegram" as const, value: `@${name.toLowerCase()}` };
    }
    ctx.addIssue({ code: "custom", message: "invalid_contact" });
    return z.NEVER;
  });

export const waitlistSchema = z.object({
  contact: contactSchema,
  destinations: z.array(z.enum(DESTINATIONS)).max(DESTINATIONS.length).default([]),
  locale: z.enum(routing.locales),
  source: z.string().trim().max(64).optional(),
  // Honeypot: real users never fill it.
  website: z.literal("").optional(),
});

export type WaitlistInput = z.input<typeof waitlistSchema>;
