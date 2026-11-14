"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/** Mini App entry (bot menu button points here): exchange signed initData for a session. */
export default function TelegramEntry() {
  const t = useTranslations("auth");
  const [state, setState] = useState<"loading" | "outside" | "failed">("loading");

  useEffect(() => {
    let tries = 0;
    // telegram-web-app.js is loaded by the (flow) layout; wait for it (max ~4 s).
    const iv = setInterval(async () => {
      const app = window.Telegram?.WebApp;
      if (!app && ++tries < 40) return;
      clearInterval(iv);
      if (!app?.initData) return setState("outside");
      const res = await fetch("/api/auth/telegram/webapp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ initData: app.initData }),
      }).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { next?: string }) : null;
      if (data?.next) window.location.replace(data.next);
      else setState("failed");
    }, 100);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-center text-muted-foreground" role="status">
        {state === "loading" ? t("tgLoading") : state === "outside" ? t("tgOutside") : t("failed")}
      </p>
    </div>
  );
}
