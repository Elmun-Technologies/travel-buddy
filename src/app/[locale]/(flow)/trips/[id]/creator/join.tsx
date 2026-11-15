"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MainAction } from "@/components/telegram-actions";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";

/** "Qatnashaman" → entry created → the tracking page. Already in → straight to it. */
export function JoinAction({ tripId, joined }: { tripId: string; joined: boolean }) {
  const t = useTranslations("creator");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (joined) return <MainAction label={t("joined")} href="/creator" />;
  return (
    <>
      {error && (
        <p role="alert" className="px-2 text-center text-danger">
          {error}
        </p>
      )}
      <MainAction
        label={t("join")}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const r = await fetch("/api/creator", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ op: "join", tripId }),
          }).catch(() => null);
          if (r?.ok) {
            haptic.celebrate();
            return router.push("/creator");
          }
          const code = ((await r?.json().catch(() => null)) as { error?: string } | null)?.error;
          setError(t(code === "yearly" ? "e_yearly" : code === "closed" ? "e_closed" : "e_failed"));
          setBusy(false);
        }}
      />
    </>
  );
}
