"use client";

import { useSyncExternalStore } from "react";

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
function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!polling && !window.Telegram?.WebApp) {
    let tries = 0;
    polling = setInterval(() => {
      if (window.Telegram?.WebApp || ++tries > 40) {
        clearInterval(polling);
        listeners.forEach((l) => l());
      }
    }, 100);
  }
  return () => listeners.delete(cb);
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

export const haptic = {
  select: () => tg()?.HapticFeedback?.selectionChanged(),
  success: () => tg()?.HapticFeedback?.notificationOccurred("success"),
  error: () => tg()?.HapticFeedback?.notificationOccurred("error"),
};
