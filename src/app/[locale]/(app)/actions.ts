"use server";

import { refresh } from "next/cache";
import { redirect } from "@/i18n/navigation";
import { fieldErrors, formError, type FormState } from "@/lib/form";
import { asLocale } from "@/lib/guard";
import { rateLimit } from "@/lib/rate-limit";
import { destroySession, getSessionUser } from "@/lib/session";
import { decideRequest, leaveTrip } from "@/modules/groups/service";
import { intentFromForm, intentSchema } from "@/modules/trips/schema";
import { closeIntent, closeTrip, createIntent } from "@/modules/trips/service";

// Every action re-reads the session: never trust the client.
async function authed(f: FormData) {
  const locale = asLocale(f.get("locale"));
  const user = await getSessionUser();
  if (!user) redirect({ href: "/login", locale });
  return { locale, user: user! };
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

export async function logoutAction(f: FormData) {
  const locale = asLocale(f.get("locale"));
  await destroySession();
  redirect({ href: "/", locale });
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
