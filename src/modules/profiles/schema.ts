import { z } from "zod";
import {
  ageOn,
  BUDGET_BANDS,
  COUNTRIES,
  GENDERS,
  GROUP_PREFS,
  INTERESTS,
  LANGUAGES,
  TRAVEL_STYLES,
} from "@/lib/catalog";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);

export const MIN_AGE = 18;

export const profileSchema = z
  .object({
    displayName: z.string().trim().min(2).max(50),
    birthDate: z.iso.date().refine((d) => {
      const age = ageOn(d);
      return age >= MIN_AGE && age <= 100;
    }, "under_18"),
    gender: z.enum(GENDERS).nullable().catch(null),
    showGender: z.boolean().default(false),
    city: optionalText(60),
    country: z.enum(COUNTRIES).nullable().catch(null),
    languages: z.array(z.enum(LANGUAGES)).min(1).max(8),
    travelStyles: z.array(z.enum(TRAVEL_STYLES)).max(8).default([]),
    interests: z.array(z.enum(INTERESTS)).max(12).default([]),
    bio: optionalText(500),
    // Optional so the profile edit form (which doesn't show them) never resets them.
    groupPref: z.enum(GROUP_PREFS).optional(),
    dreamDestinations: z.array(z.enum(COUNTRIES)).max(12).optional(),
    budgetBand: z.enum(BUDGET_BANDS).nullable().optional(),
  })
  .refine((p) => p.groupPref !== "women_only" || p.gender === "female", {
    path: ["groupPref"],
    message: "women_only_pref",
  });

export type ProfileInput = z.output<typeof profileSchema>;

export function profileFromForm(f: FormData) {
  return {
    displayName: f.get("displayName") ?? "",
    birthDate: f.get("birthDate") ?? "",
    gender: f.get("gender") || null,
    showGender: f.get("showGender") === "on",
    city: f.get("city") ?? "",
    country: f.get("country") || null,
    languages: f.getAll("languages"),
    travelStyles: f.getAll("travelStyles"),
    interests: f.getAll("interests"),
    bio: f.get("bio") ?? "",
  };
}
