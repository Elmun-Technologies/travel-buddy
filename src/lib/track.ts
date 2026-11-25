import "server-only";
import { after } from "next/server";
import { type EventName, personId, sendEvent } from "./analytics";

/** Record an event for a signed-in person after the response has gone out. */
export function track(event: EventName, userId: string, props: Record<string, unknown> = {}) {
  const run = () => sendEvent(event, personId(userId), props);
  try {
    after(run);
  } catch {
    void run(); // outside a request (tests, scripts)
  }
}
