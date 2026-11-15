"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { setSoundOn, sound, soundOn, subscribeSound } from "@/lib/sound";
import { cn } from "@/lib/utils";

const TAPPABLE = "button, a, [role=switch], [role=tab], [role=radio], label, summary";

/** Mounted once in the root layout: a soft tick on every tap of something interactive. */
export function SoundRoot() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(TAPPABLE);
      if (el && !(el as HTMLButtonElement).disabled) sound.tap();
    };
    document.addEventListener("pointerdown", onDown, { capture: true, passive: true });
    return () => document.removeEventListener("pointerdown", onDown, { capture: true });
  }, []);
  return null;
}

const useSoundOn = () => useSyncExternalStore(subscribeSound, soundOn, () => true);

/** Small speaker in a corner (home header): one tap mutes or unmutes every sound. */
export function SoundButton({ className }: { className?: string }) {
  const t = useTranslations("sound");
  const on = useSoundOn();
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? t("turnOff") : t("turnOn")}
      onClick={() => {
        setSoundOn(!on);
        if (!on) sound.success();
      }}
      className={cn("flex size-11 items-center justify-center rounded-full text-muted-foreground", className)}
    >
      {on ? (
        <Volume2 className="size-5" aria-hidden="true" />
      ) : (
        <VolumeX className="size-5" aria-hidden="true" />
      )}
    </button>
  );
}

/** Profile settings row. */
export function SoundSwitch() {
  const on = useSoundOn();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby="sound-label"
      onClick={() => {
        setSoundOn(!on);
        if (!on) sound.success();
      }}
      className="flex min-h-11 flex-none items-center"
    >
      <span
        className={cn(
          "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors",
          on ? "bg-ink" : "bg-line",
        )}
      >
        <span
          className={cn("size-6 rounded-full bg-white shadow transition-transform", on && "translate-x-5")}
        />
      </span>
    </button>
  );
}
