"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

type Candidate = { userId: string; name: string; age: number; percent: number; invited: boolean };

/** Organizer's "Mos sayohatchilar": people whose notes fit this trip, one tap to invite. */
export function Candidates({ tripId, items }: { tripId: string; items: Candidate[] }) {
  const t = useTranslations("trip");
  const [done, setDone] = useState<string[]>(items.filter((i) => i.invited).map((i) => i.userId));
  return (
    <div className="flex flex-col gap-2">
      {items.map((c) => (
        <div
          key={c.userId}
          className="flex items-center justify-between gap-3 border-t border-line pt-2 first:border-t-0 first:pt-0"
        >
          <span className="flex flex-col">
            <span className="font-semibold">
              {c.name}, {c.age}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("matchPercent", { n: Math.round(c.percent) })}
            </span>
          </span>
          {done.includes(c.userId) ? (
            <span className="text-sm text-muted-foreground">{t("invited")}</span>
          ) : (
            <button
              type="button"
              className="press min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-white"
              onClick={async () => {
                const res = await fetch(`/api/trips/${tripId}/invite`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ userId: c.userId }),
                }).catch(() => null);
                if (res?.ok || res?.status === 409) setDone((d) => [...d, c.userId]);
              }}
            >
              {t("invite")}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
