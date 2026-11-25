"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { clayInput, Panel } from "@/components/clay";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

/** One companion: five tappable stars, an optional kind word, one send. */
export function RateRow({
  tripId,
  person,
}: {
  tripId: string;
  person: { id: string; name: string; rating: number | null };
}) {
  const t = useTranslations("reviews");
  const [rating, setRating] = useState(person.rating ?? 0);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(person.rating ? "sent" : "idle");

  async function send() {
    if (!rating || state === "sending") return;
    setState("sending");
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tripId, subjectId: person.id, rating, body: note || undefined }),
    }).catch(() => null);
    if (res?.ok) {
      haptic.success();
      setState("sent");
    } else {
      haptic.error();
      setState("error");
    }
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-lg font-semibold">{person.name}</span>
        {state === "sent" && <span className="text-sm text-success">{t("thanks")}</span>}
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label={person.name}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={t("stars", { n })}
            onClick={() => {
              haptic.select();
              setRating(n);
              if (state === "sent") setState("idle");
            }}
            className="flex size-11 items-center justify-center"
          >
            <Star
              className={cn("size-8", n <= rating ? "fill-signal stroke-ink" : "stroke-line")}
              strokeWidth={1.5}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
      {rating > 0 && state !== "sent" && (
        <>
          <input
            value={note}
            maxLength={280}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("note")}
            aria-label={t("note")}
            className={clayInput}
          />
          <button
            type="button"
            onClick={send}
            disabled={state === "sending"}
            className="press min-h-11 self-start rounded-full bg-ink px-6 text-[15px] font-medium text-white disabled:opacity-60"
          >
            {t("send")}
          </button>
        </>
      )}
      {state === "error" && (
        <p role="alert" className="text-sm text-danger">
          {t("error")}
        </p>
      )}
    </Panel>
  );
}
