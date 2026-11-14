"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MainAction } from "@/components/telegram-actions";
import { useRouter } from "@/i18n/navigation";
import { haptic, useTelegramChrome } from "@/lib/telegram-webapp";

/** "Men ham boraman!" — Telegram MainButton in the Mini App, a bottom button on the web. */
export function JoinAction({ tripId, organizer }: { tripId: string; organizer: string | null }) {
  const t = useTranslations("trip");
  const te = useTranslations("errors");
  const router = useRouter();
  const inTelegram = !!useTelegramChrome();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).catch(() => null);
    if (res?.ok) {
      haptic.success();
      router.refresh(); // page now shows "request sent"
      return;
    }
    setPending(false);
    haptic.error();
    const code = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : null;
    setError(code ?? "network");
  }

  return (
    <>
      {error && (
        <p role="alert" className="rounded-[18px] bg-danger-soft p-4 text-sm text-danger">
          {error === "network" ? t("joinNetwork") : te(error)}
        </p>
      )}
      <MainAction label={t("joinCta")} onClick={join} loading={pending} />
      {!inTelegram && organizer && (
        <p className="-mt-1 pb-4 text-center text-xs text-muted-foreground">
          {t("joinCaption", { name: organizer })}
        </p>
      )}
    </>
  );
}
