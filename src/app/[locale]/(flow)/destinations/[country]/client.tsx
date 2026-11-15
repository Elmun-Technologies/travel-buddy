"use client";

import { useEffect, useState } from "react";
import { Heart, Music } from "lucide-react";
import { useTranslations } from "next-intl";
import { playCountry, stopMusic } from "@/lib/music";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

const glass =
  "flex min-h-11 items-center gap-2 rounded-full bg-white/90 px-4 text-[15px] font-medium text-ink backdrop-blur";

/** The country's tune plays when the page opens (after the tap that opened it); tap to hear again. */
export function CountryMusic({ country }: { country: string }) {
  const t = useTranslations("destination");
  useEffect(() => {
    playCountry(country);
    return () => stopMusic();
  }, [country]);
  return (
    <button
      type="button"
      aria-label={t("playMusic")}
      onClick={() => playCountry(country)}
      className={cn(glass, "px-3")}
    >
      <Music className="size-4" aria-hidden="true" />
    </button>
  );
}

/** "Saqlash": the country joins the profile's dream destinations (feed and matching use them). */
export function SaveDestination({
  country,
  initial,
  signedIn,
}: {
  country: string;
  initial: boolean;
  signedIn: boolean;
}) {
  const t = useTranslations("destination");
  const [on, setOn] = useState(initial);
  if (!signedIn) return null;
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={async () => {
        setOn(!on);
        haptic.select();
        const r = await fetch("/api/profile/dream", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ country, on: !on }),
        }).catch(() => null);
        if (!r?.ok) setOn(on);
      }}
      className={glass}
    >
      <Heart className={cn("size-4", on && "pop-in fill-danger text-danger")} aria-hidden="true" />
      {on ? t("saved") : t("save")}
    </button>
  );
}
