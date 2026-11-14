"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

const REASONS = ["fake", "dating", "unsafe", "other"] as const;

/** "Shikoyat qilish": pick a reason, sent in one tap. */
export function ReportLink({
  targetType,
  targetId,
  className,
}: {
  targetType: "user" | "trip" | "message";
  targetId: string;
  className?: string;
}) {
  const t = useTranslations("report");
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sent" | "error">("idle");

  async function send(reason: (typeof REASONS)[number]) {
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType, targetId, reason }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
    if (res?.ok) haptic.success();
    setOpen(false);
  }

  if (state === "sent") return <p className={cn("text-sm", className)}>{t("sent")}</p>;
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn("min-h-11 self-start text-left text-sm underline underline-offset-4", className)}
      >
        {t("link")}
      </button>
      {open && (
        <div className="flex flex-wrap gap-1.5">
          {REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => send(r)}
              className="min-h-11 rounded-full border border-current/30 px-4 text-sm"
            >
              {t(`reasons.${r}`)}
            </button>
          ))}
        </div>
      )}
      {state === "error" && <p className="text-sm">{t("error")}</p>}
    </div>
  );
}
