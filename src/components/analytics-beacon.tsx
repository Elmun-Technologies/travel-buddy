"use client";

import { useEffect } from "react";
import { usePathname } from "@/i18n/navigation";

const store = (kind: "local" | "session") => {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null; // blocked (private mode, some WebViews): analytics just goes anonymous
  }
};

function anonId() {
  const s = store("local");
  let id = s?.getItem("tb_aid") ?? "";
  if (!/^[a-f0-9]{16}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join(
      "",
    );
    s?.setItem("tb_aid", id);
  }
  return id;
}

/** First-touch campaign of this visit (?utm_source=instagram…), kept for the session. */
function campaign() {
  const s = store("session");
  const q = new URLSearchParams(window.location.search);
  const fresh = ["utm_source", "utm_medium", "utm_campaign"].filter((k) => q.get(k));
  if (fresh.length)
    s?.setItem(
      "tb_utm",
      JSON.stringify(Object.fromEntries(fresh.map((k) => [k, (q.get(k) ?? "").slice(0, 60)]))),
    );
  try {
    return JSON.parse(s?.getItem("tb_utm") ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/** Fire-and-forget event to /api/track. Honors "Do Not Track". */
export function trackEvent(event: "pageview" | "share_clicked", extra: Record<string, string> = {}) {
  if (typeof navigator === "undefined" || navigator.doNotTrack === "1") return;
  void fetch("/api/track", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event,
      path: window.location.pathname.slice(0, 200),
      referrer: document.referrer.slice(0, 200) || undefined,
      anon: anonId(),
      ...campaign(),
      ...extra,
    }),
  })
    .then((r) => r.text()) // read the (tiny) body so the request is fully finished
    .catch(() => {});
}

/** One pageview per navigation. Mounted once in the layout. */
export function AnalyticsBeacon() {
  const path = usePathname();
  useEffect(() => {
    trackEvent("pageview");
  }, [path]);
  return null;
}
