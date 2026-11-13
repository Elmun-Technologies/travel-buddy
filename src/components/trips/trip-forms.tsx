"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { createIntentAction, createTripAction } from "@/app/[locale]/(app)/actions";
import { ChipGroup, Field, FormError, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { ACCOMMODATION, CURRENCIES, type Option, TRAVEL_STYLES } from "@/lib/catalog";

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

export function TripForm({ minDate, countries }: FormProps) {
  const t = useTranslations("trip");
  const tc = useTranslations("common");
  const ta = useTranslations("accommodation");
  const locale = useLocale();
  const [state, action, pending] = useActionState(createTripAction, null);
  const v = (state?.values as Values | undefined) ?? {};
  const e = state?.errors ?? {};
  return (
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <FormError code={e._form} />
      <Field label={t("title")} name="title" error={e.title}>
        <input
          id="title"
          name="title"
          required
          minLength={5}
          maxLength={80}
          placeholder={t("titlePlaceholder")}
          defaultValue={s(v.title)}
          className={inputClass}
          aria-invalid={!!e.title}
        />
      </Field>
      <PlaceFields v={v} e={e} minDate={minDate} countries={countries} />
      <div className="grid gap-5 sm:grid-cols-3">
        <Field label={t("groupSizeMax")} name="groupSizeMax" error={e.groupSizeMax}>
          <input
            id="groupSizeMax"
            name="groupSizeMax"
            type="number"
            required
            min={2}
            max={30}
            defaultValue={s(v.groupSizeMax) || "4"}
            className={inputClass}
          />
        </Field>
        <Field label={t("ageMin")} name="ageMin" error={e.ageMin}>
          <input
            id="ageMin"
            name="ageMin"
            type="number"
            min={18}
            max={99}
            defaultValue={s(v.ageMin)}
            className={inputClass}
          />
        </Field>
        <Field label={t("ageMax")} name="ageMax" error={e.ageMax}>
          <input
            id="ageMax"
            name="ageMax"
            type="number"
            min={18}
            max={99}
            defaultValue={s(v.ageMax)}
            className={inputClass}
          />
        </Field>
        <Field label={t("accommodationPref")} name="accommodationPref">
          <select
            id="accommodationPref"
            name="accommodationPref"
            defaultValue={s(v.accommodationPref) || "any"}
            className={inputClass}
          >
            {ACCOMMODATION.map((a) => (
              <option key={a} value={a}>
                {ta(a)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="womenOnly"
          defaultChecked={v.womenOnly === true}
          className="mt-0.5 size-5 accent-primary"
        />
        <span>
          <span className="font-medium">{t("womenOnly")}</span>
          <span className="block text-sm text-muted-foreground">{t("womenOnlyHint")}</span>
        </span>
      </label>
      <Field label={`${t("description")} (${tc("optional")})`} name="description" error={e.description}>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={2000}
          placeholder={t("descriptionPlaceholder")}
          defaultValue={s(v.description)}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>
      <Button type="submit" disabled={pending} className="h-11 text-base sm:self-start sm:px-8">
        {pending ? tc("saving") : t("submit")}
      </Button>
    </form>
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
