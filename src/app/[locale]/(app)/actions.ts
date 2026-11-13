"use server";

import { refresh } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { fieldErrors, formError, type FormState } from "@/lib/form";
import { asLocale } from "@/lib/guard";
import { rateLimit } from "@/lib/rate-limit";
import { destroySession, getSessionUser } from "@/lib/session";
import { decideRequest, leaveTrip, requestJoin } from "@/modules/groups/service";
import { profileFromForm, profileSchema } from "@/modules/profiles/schema";
import { saveProfile } from "@/modules/profiles/service";
import { intentFromForm, intentSchema, tripFromForm, tripSchema } from "@/modules/trips/schema";
import { closeIntent, closeTrip, createIntent, createTrip } from "@/modules/trips/service";

// Every action re-reads the session: never trust the client.
async function authed(f: FormData) {
  const locale = asLocale(f.get("locale"));
  const user = await getSessionUser();
  if (!user) redirect({ href: "/login", locale });
  return { locale, user: user! };
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function saveProfileAction(_: FormState, f: FormData): Promise<FormState> {
  const { locale, user } = await authed(f);
  const raw = profileFromForm(f);
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values: raw };
  await saveProfile(user.id, parsed.data);
  redirect({ href: str(f.get("next")) === "trips" ? "/trips" : "/me", locale });
  return null;
}

export async function logoutAction(f: FormData) {
  const locale = asLocale(f.get("locale"));
  await destroySession();
  redirect({ href: "/", locale });
}

export async function createTripAction(_: FormState, f: FormData): Promise<FormState> {
  const { locale, user } = await authed(f);
  const raw = tripFromForm(f);
  const parsed = tripSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values: raw };
  if (!(await rateLimit(`trip:user:${user.id}`, 10, 86_400)))
    return { ...formError("rate_limited")!, values: raw };
  const res = await createTrip(user.id, parsed.data);
  if (!res.ok) return { ...formError(res.error)!, values: raw };
  redirect({ href: `/trips/${res.id}`, locale });
  return null;
}

export async function createIntentAction(_: FormState, f: FormData): Promise<FormState> {
  const { locale, user } = await authed(f);
  const raw = intentFromForm(f);
  const parsed = intentSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error), values: raw };
  if (!(await rateLimit(`intent:user:${user.id}`, 10, 86_400)))
    return { ...formError("rate_limited")!, values: raw };
  const res = await createIntent(user.id, parsed.data);
  if (!res.ok) return { ...formError(res.error)!, values: raw };
  redirect({ href: "/me", locale });
  return null;
}

export async function closeIntentAction(f: FormData) {
  const { user } = await authed(f);
  await closeIntent(user.id, str(f.get("intentId")));
  refresh();
}

export async function joinAction(_: FormState, f: FormData): Promise<FormState> {
  const { user } = await authed(f);
  if (!(await rateLimit(`join:user:${user.id}`, 30, 3600))) return formError("rate_limited");
  const message = str(f.get("message")).trim().slice(0, 500) || null;
  const res = await requestJoin(user.id, str(f.get("tripId")), message);
  if (!res.ok) return formError(res.error);
  refresh();
  return null;
}

export async function decideAction(f: FormData) {
  const { user } = await authed(f);
  await decideRequest(user.id, str(f.get("tripId")), str(f.get("userId")), f.get("decision") === "approve");
  refresh();
}

export async function leaveAction(f: FormData) {
  const { user } = await authed(f);
  await leaveTrip(user.id, str(f.get("tripId")));
  refresh();
}

export async function closeTripAction(f: FormData) {
  const { user } = await authed(f);
  await closeTrip(user.id, str(f.get("tripId")));
  refresh();
}
