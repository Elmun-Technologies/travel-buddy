import { createHash } from "node:crypto";

// Product analytics (PostHog Cloud, EU) without any third-party script in the browser: the app and
// the worker send a few well-named events from the server. No key → every call does nothing.
// Funnel: signup → profile_saved → trip_created / join_requested → join_approved → message_sent → review_submitted.
// People are identified by a one-way hash of their id; no names, phones or message text are sent.

export type EventName =
  | "pageview"
  | "signup"
  | "bot_start"
  | "phone_verified"
  | "profile_saved"
  | "trip_created"
  | "trip_edited"
  | "join_requested"
  | "join_approved"
  | "message_sent"
  | "review_submitted"
  | "share_clicked"
  | "account_deleted";

const key = () => process.env.POSTHOG_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY || "";
const host = () => (process.env.POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");

/** Stable, anonymous id for a person. */
export const personId = (userId: string) =>
  `u_${createHash("sha256").update(userId).digest("hex").slice(0, 20)}`;

/** Fire one event. Never throws, never waits longer than 3 s. */
export async function sendEvent(event: EventName, distinctId: string, props: Record<string, unknown> = {}) {
  const k = key();
  if (!k) return;
  try {
    await fetch(`${host()}/capture/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: k,
        event,
        distinct_id: distinctId,
        properties: { ...props, env: process.env.APP_ENV ?? "unset", $geoip_disable: true },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // analytics must never break the product
  }
}
