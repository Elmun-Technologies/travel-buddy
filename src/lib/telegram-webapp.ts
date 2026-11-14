"use client";

import { useSyncExternalStore } from "react";
import { confetti } from "./confetti";
import { sound } from "./sound";

// Minimal typing of https://core.telegram.org/bots/webapps (only what we use).
type TgButton = {
  setParams(p: {
    text?: string;
    color?: string;
    text_color?: string;
    is_active?: boolean;
    is_visible?: boolean;
  }): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
  show(): void;
  hide(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
};
export type TgWebApp = {
  initData: string;
  version?: string;
  ready(): void;
  expand(): void;
  isVersionAtLeast?(v: string): boolean;
  setHeaderColor?(c: string): void;
  setBackgroundColor?(c: string): void;
  requestContact?(cb?: (shared: boolean) => void): void;
  openLink?(url: string): void;
  openTelegramLink?(url: string): void;
  MainButton?: TgButton;
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: {
    selectionChanged(): void;
    notificationOccurred(t: "error" | "success" | "warning"): void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

export const TG_SCRIPT = "https://telegram.org/js/telegram-web-app.js";

/** The Mini App API, or null on the regular web (no initData) and during SSR. */
export function tg(): TgWebApp | null {
  if (typeof window === "undefined") return null;
  const app = window.Telegram?.WebApp;
  return app?.initData ? app : null;
}

// telegram-web-app.js loads after hydration; re-render once it is there.
const listeners = new Set<() => void>();
let polling: ReturnType<typeof setInterval> | undefined;
// Telegram keeps the native buttons across full page loads (e.g. after a reload or a hard
// navigation), so a stale "Save profile" button could sit over the page and do nothing.
// Hide them once per page load, before any MainAction sets them up (first subscribe runs first).
let reset = false;
function resetChrome() {
  if (reset || !window.Telegram?.WebApp) return;
  reset = true;
  window.Telegram.WebApp.MainButton?.hide();
  window.Telegram.WebApp.BackButton?.hide();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  resetChrome();
  if (!polling && !window.Telegram?.WebApp) {
    let tries = 0;
    polling = setInterval(() => {
      if (window.Telegram?.WebApp || ++tries > 40) {
        clearInterval(polling);
        resetChrome();
        listeners.forEach((l) => l());
      }
    }, 100);
  }
  return () => listeners.delete(cb);
}

/** Open a link the right way: inside Telegram via the Mini App API (plain t.me links are ignored there). */
export function openExternal(url: string) {
  const app = tg();
  if (app && /^https:\/\/t\.me\//.test(url) && app.openTelegramLink) return app.openTelegramLink(url);
  if (app?.openLink) return app.openLink(url);
  window.open(url, "_blank", "noopener");
}

/** True inside Telegram when the native MainButton/BackButton are available. */
export function useTelegramChrome(): TgWebApp | null {
  return useSyncExternalStore(
    subscribe,
    () => {
      const app = tg();
      return app?.MainButton && app.BackButton ? app : null;
    },
    () => null,
  );
}

/** Touch feedback: Telegram vibration plus the matching UI sound (src/lib/sound.ts). */
export const haptic = {
  select: () => {
    tg()?.HapticFeedback?.selectionChanged();
    sound.pop();
  },
  success: () => {
    tg()?.HapticFeedback?.notificationOccurred("success");
    sound.success();
  },
  error: () => {
    tg()?.HapticFeedback?.notificationOccurred("error");
    sound.error();
  },
  /** Big moments: trip opened, joined a group. Vibration, arpeggio and confetti. */
  celebrate: () => {
    tg()?.HapticFeedback?.notificationOccurred("success");
    sound.celebrate();
    confetti();
  },
};
