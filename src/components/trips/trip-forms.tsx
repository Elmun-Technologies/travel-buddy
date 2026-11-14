"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createIntentAction } from "@/app/[locale]/(app)/actions";
import { ChipGroup, Field, FormError, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { CURRENCIES, type Option, TRAVEL_STYLES } from "@/lib/catalog";

type Values = Record<string, string | string[] | boolean | number | null | undefined>;
// On validation errors the action echoes the raw form values back (budget still in major units).
const s = (v: Values[string]) => (v == null || typeof v === "boolean" ? "" : String(v));

type FormProps = { minDate: string; countries: Option[] };

function PlaceFields({ v, e, minDate, countries }: FormProps & { v: Values; e: Record<string, string> }) {
  const t = useTranslations("trip");
  const tc = useTranslations("common");
  const ts = useTranslations("styles");
  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("destinationCountry")} name="destinationCountry" error={e.destinationCountry}>
          <select
            id="destinationCountry"
            name="destinationCountry"
            required
            defaultValue={s(v.destinationCountry)}
            className={inputClass}
          >
            <option value="" disabled>
              —
            </option>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={`${t("destinationCity")} (${tc("optional")})`}
          name="destinationCity"
          error={e.destinationCity}
        >
          <input
            id="destinationCity"
            name="destinationCity"
            maxLength={60}
            defaultValue={s(v.destinationCity)}
            className={inputClass}
          />
        </Field>
        <Field label={t("startDate")} name="startDate" error={e.startDate}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            min={minDate}
            defaultValue={s(v.startDate)}
            className={inputClass}
            aria-invalid={!!e.startDate}
          />
        </Field>
        <Field label={t("endDate")} name="endDate" error={e.endDate}>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            min={minDate}
            defaultValue={s(v.endDate)}
            className={inputClass}
            aria-invalid={!!e.endDate}
          />
        </Field>
        <Field label={t("dateFlexDays")} name="dateFlexDays" error={e.dateFlexDays}>
          <input
            id="dateFlexDays"
            name="dateFlexDays"
            type="number"
            min={0}
            max={14}
            defaultValue={s(v.dateFlexDays) || "0"}
            className={inputClass}
          />
        </Field>
        <div className="grid grid-cols-[1fr_1fr_6rem] items-start gap-2">
          <Field label={t("budgetMin")} name="budgetMin" error={e.budgetMin}>
            <input
              id="budgetMin"
              name="budgetMin"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={s(v.budgetMin)}
              className={inputClass}
            />
          </Field>
          <Field label={t("budgetMax")} name="budgetMax" error={e.budgetMax}>
            <input
              id="budgetMax"
              name="budgetMax"
              type="number"
              min={0}
              inputMode="numeric"
              defaultValue={s(v.budgetMax)}
              className={inputClass}
            />
          </Field>
          <Field label={t("currency")} name="currency">
            <select
              id="currency"
              name="currency"
              defaultValue={s(v.currency) || "USD"}
              className={inputClass}
            >
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <ChipGroup
        legend={t("travelStyles")}
        name="travelStyles"
        selected={(v.travelStyles as string[]) ?? []}
        error={e.travelStyles}
        options={TRAVEL_STYLES.map((x) => ({ value: x, label: ts(x) }))}
      />
    </>
  );
}

export function IntentForm({ minDate, countries }: FormProps) {
  const t = useTranslations("intent");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createIntentAction, null);
  const v = (state?.values as Values | undefined) ?? {};
  const e = state?.errors ?? {};
  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <FormError code={e._form} />
      <PlaceFields v={v} e={e} minDate={minDate} countries={countries} />
      <Field label={`${t("note")} (${tc("optional")})`} name="note" error={e.note}>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          placeholder={t("notePlaceholder")}
          defaultValue={s(v.note)}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      <Button type="submit" disabled={pending} className="h-11 text-base sm:self-start sm:px-8">
        {pending ? tc("saving") : t("submit")}
      </Button>
    </form>
  );
}
