"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Telegram keeps Mini App pages open for days. When a new build is live, ask the user to reload
 * instead of letting a stale page fail. The layout renders <html data-build> (NEXT_DEPLOYMENT_ID).
 */
export function UpdateBanner() {
  const t = useTranslations("app");
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const mine = document.documentElement.dataset.build;
    if (!mine) return; // dev / no deployment id
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch("/api/version", { cache: "no-store" }).catch(() => null);
      const id = res?.ok ? ((await res.json()) as { id: string | null }).id : null;
      if (!id || id === mine) return;
      // Inside the Mini App (reopened after a deploy): just reload — drafts are saved server-side.
      // Once per new build (sessionStorage guard): never a reload loop if ids keep differing.
      const key = `tb:reloaded:${id}`;
      let first = false;
      try {
        first = !sessionStorage.getItem(key);
        sessionStorage.setItem(key, "1");
      } catch {}
      if (window.Telegram?.WebApp?.initData && first) window.location.reload();
      else setStale(true);
    };
    void check(); // the WebView may resume a page from before the deploy
    const iv = setInterval(check, 120_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(iv);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (!stale) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-50 flex items-center justify-between gap-3 rounded-2xl bg-foreground p-4 text-sm text-background shadow-lg"
    >
      <span>{t("updateAvailable")}</span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="h-11 shrink-0 rounded-full bg-background px-5 font-medium text-foreground"
      >
        {t("updateNow")}
      </button>
    </div>
  );
}
