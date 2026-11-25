"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { joinWaitlist, type JoinResult } from "@/modules/waitlist/service";

export async function joinWaitlistAction(_prev: JoinResult | null, form: FormData): Promise<JoinResult> {
  // Honeypot filled → pretend success so bots learn nothing.
  if (form.get("website")) return { ok: true };
  try {
    const h = await headers();
    const ip = clientIp(h);
    if (!(await rateLimit(`waitlist:ip:${ip}`, 5, 3600))) return { ok: false, error: "rate_limited" };
    // Same-origin POST carries the full page URL in Referer → utm_source for marketing.
    let source: string | undefined;
    try {
      source = new URL(h.get("referer") ?? "").searchParams.get("utm_source")?.slice(0, 64) || undefined;
    } catch {}
    return await joinWaitlist({
      contact: form.get("contact"),
      destinations: form.getAll("destinations"),
      locale: form.get("locale"),
      source,
      website: "",
    });
  } catch (e) {
    console.error("waitlist failed", e);
    return { ok: false, error: "server" };
  }
}
