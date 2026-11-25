"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ReportLink } from "@/components/report-link";
import { useRouter } from "@/i18n/navigation";

/** Quiet safety actions on another person's profile: report, or block (two taps). */
export function ProfileSafety({ userId }: { userId: string }) {
  const t = useTranslations("report");
  const router = useRouter();
  const [ask, setAsk] = useState(false);
  const [error, setError] = useState(false);

  async function block() {
    setError(false);
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    if (res?.ok) router.replace("/trips");
    else setError(true);
  }

  return (
    <div className="flex flex-col gap-1 px-2 pt-2">
      <ReportLink targetType="user" targetId={userId} className="text-muted-foreground" />
      {!ask ? (
        <button
          type="button"
          onClick={() => setAsk(true)}
          className="min-h-11 self-start text-left text-sm text-danger underline underline-offset-4"
        >
          {t("block")}
        </button>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl bg-card p-4">
          <p className="text-[15px]">{t("blockAsk")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={block}
              className="min-h-11 rounded-full bg-danger px-5 text-[15px] font-medium text-white"
            >
              {t("blockConfirm")}
            </button>
            <button
              type="button"
              onClick={() => setAsk(false)}
              className="min-h-11 rounded-full border border-line px-5 text-[15px]"
            >
              {t("blockCancel")}
            </button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {t("error")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
