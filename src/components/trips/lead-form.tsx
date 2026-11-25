"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { clayInput } from "@/components/clay";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

/** "Ariza qoldirish" on an agency tour: how many people, an optional word, one send. */
export function LeadForm({ tripId, maxPeople }: { tripId: string; maxPeople: number }) {
  const t = useTranslations("agency");
  const router = useRouter();
  const [people, setPeople] = useState(1);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error" | string>("idle");

  async function send() {
    setState("busy");
    const res = await fetch(`/api/trips/${tripId}/lead`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ people, message: message || undefined }),
    }).catch(() => null);
    if (res?.ok) {
      haptic.celebrate();
      router.refresh();
      return;
    }
    haptic.error();
    const e = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "error";
    setState(
      e === "phone_required" ? "phone" : e === "closed" ? "closed" : e === "already" ? "already" : "error",
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-panel bg-card p-4">
      <h2 className="font-display text-2xl">{t("leadTitle")}</h2>
      <p className="text-sm text-muted-foreground">{t("leadLead")}</p>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">{t("leadPeople")}</span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            aria-label="−"
            onClick={() => setPeople(Math.max(1, people - 1))}
            className="flex size-11 items-center justify-center rounded-full border border-input"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="w-6 text-center font-display text-2xl" aria-live="polite">
            {people}
          </span>
          <button
            type="button"
            aria-label="+"
            onClick={() => setPeople(Math.min(maxPeople, people + 1))}
            className="flex size-11 items-center justify-center rounded-full border border-input"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </span>
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={500}
        rows={2}
        aria-label={t("leadMsg")}
        placeholder={t("leadMsg")}
        className={cn(clayInput, "rounded-[18px] py-3")}
      />
      <p className="text-xs text-muted-foreground">{t("contactNote")}</p>
      {state !== "idle" && state !== "busy" && (
        <p role="alert" className="text-sm text-danger">
          {state === "phone" ? t("leadPhone") : state === "closed" ? t("leadClosed") : t("errGeneric")}
        </p>
      )}
      <button
        type="button"
        disabled={state === "busy"}
        onClick={send}
        className="press min-h-[52px] rounded-button bg-ink px-4 font-semibold text-white disabled:opacity-60"
      >
        {t("leadSend")}
      </button>
    </div>
  );
}
