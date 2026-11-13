"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData: string; ready: () => void; expand: () => void } };
  }
}

/** Mini App entry (bot menu button points here): exchange signed initData for a session. */
export default function TelegramEntry() {
  const t = useTranslations("auth");
  const [state, setState] = useState<"loading" | "outside" | "failed">("loading");

  useEffect(() => {
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-web-app.js";
    s.onload = async () => {
      const app = window.Telegram?.WebApp;
      if (!app?.initData) return setState("outside");
      app.ready();
      app.expand();
      const res = await fetch("/api/auth/telegram/webapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: app.initData }),
      }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { next?: string }) : null;
      if (data?.next) window.location.replace(data.next);
      else setState("failed");
    };
    s.onerror = () => setState("failed");
    document.head.appendChild(s);
  }, []);

  return (
    <p className="py-16 text-center text-muted-foreground" role="status">
      {state === "loading" ? t("tgLoading") : state === "outside" ? t("tgOutside") : t("failed")}
    </p>
  );
}
