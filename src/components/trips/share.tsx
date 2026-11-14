"use client";

import { useState } from "react";
import { ChevronRight, Link2, Send, Smartphone, Upload } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Display, Panel } from "@/components/clay";
import { haptic, openExternal, tg } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

export type ShareLinks = { tripId: string; title: string; tgLink: string | null; webLink: string };

/** One tap sharing (product-decisions §3): Telegram, copy link, story picture. No bonuses, no contacts import. */
function useShare(s: ShareLinks) {
  const t = useTranslations("share");
  const locale = useLocale();
  const [copied, setCopied] = useState(false);
  const link = s.tgLink ?? s.webLink;
  return {
    link,
    copied,
    telegram() {
      haptic.select();
      const text = t("text", { title: s.title });
      if (!tg() && typeof navigator.share === "function") {
        void navigator.share({ url: s.webLink, text }).catch(() => {});
        return;
      }
      openExternal(`https://t.me/share/url?${new URLSearchParams({ url: link, text })}`);
    },
    async copy() {
      await navigator.clipboard?.writeText(link).catch(() => {});
      haptic.success();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    },
    story() {
      openExternal(`${window.location.origin}/api/trips/${s.tripId}/story?locale=${locale}`);
    },
  };
}

/** App-CreateTrip-Share.png: three rows. */
export function ShareList(s: ShareLinks) {
  const t = useTranslations("share");
  const sh = useShare(s);
  const row = "press flex min-h-[72px] w-full items-center gap-3.5 rounded-[18px] px-4 py-3 text-left";
  const icon = "flex size-12 flex-none items-center justify-center rounded-[14px]";
  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={sh.telegram} className={cn(row, "bg-ink text-white")}>
        <span className={cn(icon, "bg-white/10")}>
          <Send className="size-5" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block text-[17px] font-semibold">{t("telegram")}</span>
          <span className="block text-[13px] text-[#c9c9c9]">{t("telegramHint")}</span>
        </span>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
      <button type="button" onClick={sh.copy} className={cn(row, "bg-card")}>
        <span className={cn(icon, "bg-background")}>
          <Link2 className="size-5" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold">{sh.copied ? t("copied") : t("copy")}</span>
          <span className="block truncate text-[13px] text-muted-foreground">
            {sh.link.replace(/^https:\/\//, "")}
          </span>
        </span>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
      <button type="button" onClick={sh.story} className={cn(row, "bg-card")}>
        <span className={cn(icon, "bg-background")}>
          <Smartphone className="size-5" strokeWidth={1.6} aria-hidden="true" />
        </span>
        <span className="flex-1">
          <span className="block text-[17px] font-semibold">{t("story")}</span>
          <span className="block text-[13px] text-muted-foreground">{t("storyHint")}</span>
        </span>
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** App-TripDetail.png: "Do'stingiz ham borsinmi? → Yuborish". */
export function ShareFriendCard(s: ShareLinks) {
  const t = useTranslations("share");
  const sh = useShare(s);
  return (
    <Panel tone="soft" className="flex items-center justify-between gap-3">
      <div>
        <Display as="div" className="text-[22px] font-medium">
          {t("friendTitle")}
        </Display>
        <p className="mt-1 text-sm">{t("friendText")}</p>
      </div>
      <button
        type="button"
        onClick={sh.telegram}
        className="press flex min-h-12 flex-none items-center gap-2 rounded-full bg-blue px-5 font-semibold text-white"
      >
        <Send className="size-4" aria-hidden="true" />
        {t("friendCta")}
      </button>
    </Panel>
  );
}

/** Share icon for the photo header. */
export function ShareIcon(s: ShareLinks) {
  const t = useTranslations("share");
  const sh = useShare(s);
  return (
    <button
      type="button"
      onClick={sh.telegram}
      aria-label={t("shareIcon")}
      className="press flex size-11 items-center justify-center rounded-full bg-white text-ink"
    >
      <Upload className="size-5" strokeWidth={1.8} aria-hidden="true" />
    </button>
  );
}
