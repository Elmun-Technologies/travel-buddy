"use client";

import { useEffect, useRef } from "react";

/** Official Telegram Login Widget; redirects to our signed callback. Needs BotFather /setdomain. */
export function TelegramLoginButton({ bot, authUrl, lang }: { bot: string; authUrl: string; lang: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const s = document.createElement("script");
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.async = true;
    s.dataset.telegramLogin = bot;
    s.dataset.size = "large";
    s.dataset.lang = lang; // otherwise Telegram picks the browser language
    s.dataset.radius = "8";
    s.dataset.authUrl = authUrl;
    s.dataset.requestAccess = "write"; // lets the bot message the user (notifications, phase 3)
    el.replaceChildren(s);
  }, [bot, authUrl, lang]);
  return <div ref={ref} className="min-h-12" />;
}
