"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { joinWaitlistAction } from "@/app/[locale]/actions";

/** Final CTA on the blue panel (Main.png): contact + "Meni yozib qo'ying". */
export function WaitlistForm({ botUrl, nowLabel }: { botUrl: string; nowLabel: string }) {
  const t = useTranslations("waitlist");
  const locale = useLocale();
  const [state, action, pending] = useActionState(joinWaitlistAction, null);

  if (state?.ok) {
    return (
      <p role="status" className="rounded-[22px] bg-white/15 p-6 text-lg font-medium">
        {t("success")}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot, hidden from humans and screen readers */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
      <label htmlFor="contact" className="text-sm">
        {t("contactLabel")}
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id="contact"
          name="contact"
          required
          maxLength={254}
          autoComplete="email"
          placeholder={t("contactPlaceholder")}
          aria-invalid={state?.ok === false && state.error === "invalid"}
          className="min-h-[52px] flex-[1_1_240px] rounded-full border-0 bg-white px-5 text-base text-ink outline-none focus-visible:ring-3 focus-visible:ring-white/60"
        />
        <button
          type="submit"
          disabled={pending}
          className="press min-h-[52px] rounded-full bg-ink px-6 text-[15px] font-medium text-white disabled:opacity-60"
        >
          {pending ? t("submitting") : t("submit")}
        </button>
      </div>
      {state?.ok === false && (
        <p role="alert" className="text-sm font-medium text-signal">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <a href={botUrl} className="self-start text-sm text-white underline-offset-4 hover:underline">
        {nowLabel}
      </a>
      <p className="text-xs text-white/75">{t("consent")}</p>
    </form>
  );
}
