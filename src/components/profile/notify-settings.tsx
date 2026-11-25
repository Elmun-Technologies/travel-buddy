"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/clay";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

const KINDS = ["pin", "poll", "mine", "chat", "match"] as const;

/** Profile → Bildirishnomalar: each kind of bot message can be turned off. Saved on every tap. */
export function NotifySettings({ initialOff }: { initialOff: string[] }) {
  const t = useTranslations("notify");
  const [off, setOff] = useState(initialOff);
  const [error, setError] = useState(false);

  async function toggle(k: string) {
    const next = off.includes(k) ? off.filter((x) => x !== k) : [...off, k];
    setOff(next);
    haptic.select();
    const r = await fetch("/api/profile/notifications", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ off: next }),
    }).catch(() => null);
    setError(!r?.ok);
    if (!r?.ok) setOff(off); // keep the screen honest
  }

  return (
    <Panel className="flex flex-col">
      <h2 className="pb-1 text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase">
        {t("title")}
      </h2>
      {KINDS.map((k) => {
        const on = !off.includes(k);
        return (
          <div
            key={k}
            className="flex min-h-16 items-center justify-between gap-3 border-b border-line py-2 last:border-0"
          >
            <div className="flex flex-col">
              <span id={`notify-${k}`} className="text-[16px]">
                {t(k)}
              </span>
              <span className="text-sm text-muted-foreground">{t(`${k}Hint`)}</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={on}
              aria-labelledby={`notify-${k}`}
              onClick={() => toggle(k)}
              className="flex min-h-11 flex-none items-center"
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors",
                  on ? "bg-ink" : "bg-line",
                )}
              >
                <span
                  className={cn(
                    "size-6 rounded-full bg-white shadow transition-transform",
                    on && "translate-x-5",
                  )}
                />
              </span>
            </button>
          </div>
        );
      })}
      {error && (
        <p role="alert" className="pt-2 text-sm text-danger">
          {t("failed")}
        </p>
      )}
    </Panel>
  );
}
