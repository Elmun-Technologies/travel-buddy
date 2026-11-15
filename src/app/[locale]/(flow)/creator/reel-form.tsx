"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BigButton, clayInput, Panel } from "@/components/clay";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";

/** "Reels'ni joyladingizmi?": the @handle and the Reel link; views are then tracked by us. */
export function ReelForm({ id, text }: { id: string; text: string }) {
  const t = useTranslations("creator");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Panel tone="dark" className="p-6">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (ev) => {
          ev.preventDefault();
          const f = new FormData(ev.currentTarget);
          setBusy(true);
          setError(null);
          const r = await fetch("/api/creator", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ op: "reel", id, instagram: f.get("ig"), reelUrl: f.get("reel") }),
          }).catch(() => null);
          setBusy(false);
          if (r?.ok) {
            haptic.success();
            return router.refresh();
          }
          haptic.error();
          setError(t(r?.status === 422 ? "invalid" : r?.status === 409 ? "e_closed" : "e_failed"));
        }}
      >
        <h3 className="font-display text-[32px] leading-tight">{t("formTitle")}</h3>
        <p className="text-white/70">{text}</p>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/70">{t("ig")}</span>
          <input
            name="ig"
            required
            placeholder={t("igPh")}
            autoComplete="off"
            className={`${clayInput} text-ink`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/70">{t("reel")}</span>
          <input
            name="reel"
            type="url"
            required
            inputMode="url"
            placeholder={t("reelPh")}
            className={`${clayInput} text-ink`}
          />
        </label>
        {error && (
          <p role="alert" className="text-signal">
            {error}
          </p>
        )}
        <BigButton type="submit" disabled={busy} aria-busy={busy} className="bg-signal text-ink">
          {t("send")}
        </BigButton>
      </form>
    </Panel>
  );
}
