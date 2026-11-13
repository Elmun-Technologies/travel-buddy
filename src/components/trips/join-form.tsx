"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { joinAction } from "@/app/[locale]/(app)/actions";
import { FormError, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";

export function JoinForm({ tripId }: { tripId: string }) {
  const t = useTranslations("trip");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState(joinAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="tripId" value={tripId} />
      <FormError code={state?.errors._form} />
      <label htmlFor="message" className="text-sm font-medium">
        {t("joinMessage")} ({tc("optional")})
      </label>
      <textarea
        id="message"
        name="message"
        rows={3}
        maxLength={500}
        placeholder={t("joinMessagePlaceholder")}
        className={`${inputClass} h-auto py-2`}
      />
      <Button type="submit" disabled={pending} className="h-11 text-base">
        {pending ? tc("saving") : t("join")}
      </Button>
    </form>
  );
}
