import "server-only";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { redirect } from "@/i18n/navigation";
import { type Locale, routing } from "@/i18n/routing";
import { getOwnProfile } from "@/modules/profiles/service";
import { getSessionUser } from "./session";

export const asLocale = (v: unknown): Locale =>
  typeof v === "string" && hasLocale(routing.locales, v) ? v : routing.defaultLocale;

export async function requireUser(locale: Locale) {
  const user = await getSessionUser();
  if (!user) return redirect({ href: "/login", locale });
  return user;
}

export async function requireProfile(locale: Locale) {
  const user = await requireUser(locale);
  const profile = await getOwnProfile(user.id);
  if (!profile) return redirect({ href: "/onboarding", locale });
  return { user, profile };
}

/** Admin pages: anyone else gets a plain 404 (the panel's existence isn't advertised). */
export async function requireAdmin() {
  const user = await getSessionUser();
  if (user?.role !== "admin") notFound();
  return user;
}
