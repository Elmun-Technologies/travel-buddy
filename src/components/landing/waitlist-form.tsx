"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { joinWaitlistAction } from "@/app/[locale]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DESTINATIONS } from "@/modules/waitlist/schema";

export function WaitlistForm() {
  const t = useTranslations("waitlist");
  const td = useTranslations("destinations");
  const locale = useLocale();
  const [state, action, pending] = useActionState(joinWaitlistAction, null);

  if (state?.ok) {
    return (
      <p role="status" className="rounded-xl bg-primary/10 p-6 text-center font-medium text-primary">
        {t("success")}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="locale" value={locale} />
      {/* Honeypot, hidden from humans and screen readers */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />

      <div className="flex flex-col gap-2">
        <label htmlFor="contact" className="text-sm font-medium">
          {t("contactLabel")}
        </label>
        <Input
          id="contact"
          name="contact"
          required
          maxLength={254}
          autoComplete="email"
          placeholder={t("contactPlaceholder")}
          aria-invalid={state?.ok === false && state.error === "invalid"}
          className="h-11 text-base"
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("destinationsLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {DESTINATIONS.map((code) => (
            <label
              key={code}
              className="cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <input type="checkbox" name="destinations" value={code} className="sr-only" />
              {td(code)}
            </label>
          ))}
        </div>
      </fieldset>

      {state?.ok === false && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${state.error}`)}
        </p>
      )}

      <Button type="submit" disabled={pending} className="h-11 text-base">
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("consent")}</p>
    </form>
  );
}
