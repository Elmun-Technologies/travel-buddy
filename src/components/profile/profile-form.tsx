"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { saveProfileAction } from "@/app/[locale]/(app)/actions";
import { ChipGroup, Field, FormError, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { GENDERS, INTERESTS, type Option, TRAVEL_STYLES } from "@/lib/catalog";

export type ProfileValues = {
  displayName: string;
  birthDate: string;
  gender: string | null;
  showGender: boolean;
  city: string;
  country: string | null;
  languages: string[];
  travelStyles: string[];
  interests: string[];
  bio: string;
};

export function ProfileForm({
  initial,
  next,
  countries,
  languages,
}: {
  initial: ProfileValues;
  next: "trips" | "me";
  countries: Option[];
  languages: Option[];
}) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const ts = useTranslations("styles");
  const ti = useTranslations("interests");
  const locale = useLocale();
  const [state, action, pending] = useActionState(saveProfileAction, null);
  const v = (state?.values as ProfileValues | undefined) ?? initial;
  const e = state?.errors ?? {};

  return (
    // key: remount with the submitted values after a validation error (React resets forms after actions)
    <form key={JSON.stringify(state)} action={action} className="flex flex-col gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      <FormError code={e._form} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t("displayName")} name="displayName" error={e.displayName}>
          <input
            id="displayName"
            name="displayName"
            required
            maxLength={50}
            defaultValue={v.displayName}
            className={inputClass}
            aria-invalid={!!e.displayName}
          />
        </Field>
        <Field label={t("birthDate")} name="birthDate" error={e.birthDate} hint={t("birthHint")}>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            required
            defaultValue={v.birthDate}
            className={inputClass}
            aria-invalid={!!e.birthDate}
          />
        </Field>
        <Field label={t("gender")} name="gender" hint={t("genderHint")}>
          <select id="gender" name="gender" defaultValue={v.gender ?? ""} className={inputClass}>
            <option value="">{t("genders.none")}</option>
            {GENDERS.map((g) => (
              <option key={g} value={g}>
                {t(`genders.${g}`)}
              </option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-3 self-center text-sm sm:pt-6">
          <input
            type="checkbox"
            name="showGender"
            defaultChecked={v.showGender}
            className="size-5 accent-primary"
          />
          {t("showGender")}
        </label>
        <Field label={`${t("city")} (${tc("optional")})`} name="city">
          <input id="city" name="city" maxLength={60} defaultValue={v.city} className={inputClass} />
        </Field>
        <Field label={`${t("country")} (${tc("optional")})`} name="country">
          <select id="country" name="country" defaultValue={v.country ?? ""} className={inputClass}>
            <option value="">—</option>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <ChipGroup
        legend={t("languages")}
        name="languages"
        error={e.languages}
        selected={v.languages}
        options={languages}
      />
      <ChipGroup
        legend={t("travelStyles")}
        name="travelStyles"
        selected={v.travelStyles}
        options={TRAVEL_STYLES.map((s) => ({ value: s, label: ts(s) }))}
      />
      <ChipGroup
        legend={t("interests")}
        name="interests"
        selected={v.interests}
        options={INTERESTS.map((s) => ({ value: s, label: ti(s) }))}
      />
      <Field label={`${t("bio")} (${tc("optional")})`} name="bio" error={e.bio}>
        <textarea
          id="bio"
          name="bio"
          rows={4}
          maxLength={500}
          defaultValue={v.bio}
          placeholder={t("bioPlaceholder")}
          className={`${inputClass} h-auto py-2`}
        />
      </Field>

      <Button type="submit" disabled={pending} className="h-11 text-base sm:self-start sm:px-8">
        {pending ? tc("saving") : tc("save")}
      </Button>
    </form>
  );
}
