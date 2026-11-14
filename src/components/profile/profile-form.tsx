"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ChipGroup, Field, FormError, inputClass } from "@/components/form";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { GENDERS, INTERESTS, type Option, TRAVEL_STYLES } from "@/lib/catalog";
import { profileFromForm } from "@/modules/profiles/schema";

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

type Draft = { data: Record<string, unknown>; savedAt: number };
type SaveState = "idle" | "saving" | "saved";
type Failure = "network" | "session" | null;

const KEYS = [
  "displayName",
  "birthDate",
  "gender",
  "showGender",
  "city",
  "country",
  "languages",
  "travelStyles",
  "interests",
  "bio",
] as const;

/** Applies only known keys of a stored draft (it may come from an older app version). */
function merge(base: ProfileValues, data: Record<string, unknown>): ProfileValues {
  const out = { ...base } as Record<string, unknown>;
  for (const k of KEYS) if (k in data) out[k] = data[k];
  return out as ProfileValues;
}

function readLocal(key: string): Draft | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
  } catch {
    return null;
  }
}

function writeLocal(key: string, draft: Draft | null) {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    // private mode / storage blocked: the server draft still covers us
  }
}

const putDraft = (data: Record<string, unknown>) =>
  fetch("/api/onboarding/draft", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });

export function ProfileForm({
  initial,
  next,
  countries,
  languages,
  draft,
}: {
  initial: ProfileValues;
  next: "trips" | "me";
  countries: Option[];
  languages: Option[];
  /** Onboarding only: autosave to this device + server so nothing typed is ever lost. */
  draft?: { key: string; server: Draft | null };
}) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const ts = useTranslations("styles");
  const ti = useTranslations("interests");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [values, setValues] = useState(() => (draft?.server ? merge(initial, draft.server.data) : initial));
  const [formKey, setFormKey] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Failure>(null);
  const [pending, setPending] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // A newer copy on this device (e.g. the server save failed offline) wins; push it to the server.
  useEffect(() => {
    if (!draft) return;
    const local = readLocal(draft.key);
    if (!local || local.savedAt <= (draft.server?.savedAt ?? 0)) return;
    // localStorage exists only after hydration, so this one-time restore has to run in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues((v) => merge(v, local.data));
    setFormKey((k) => k + 1);
    void putDraft(local.data).catch(() => {});
  }, [draft]);

  const read = () => profileFromForm(new FormData(formRef.current!)) as Record<string, unknown>;

  function onChange() {
    if (!draft) return;
    const data = read();
    writeLocal(draft.key, { data, savedAt: Date.now() });
    setSaveState("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await putDraft(data).catch(() => null);
      // Offline is fine: the device copy is kept and re-sent on the next change or visit.
      setSaveState(res?.ok ? "saved" : "idle");
    }, 700);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    clearTimeout(timer.current);
    const data = read();
    setPending(true);
    setFailure(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => null);
    if (res?.ok) {
      if (draft) writeLocal(draft.key, null);
      router.replace(next === "trips" ? "/trips" : "/me");
      return; // keep the button disabled while navigating
    }
    setPending(false);
    if (res?.status === 422) {
      setErrors(((await res.json()) as { errors: Record<string, string> }).errors);
      return;
    }
    if (draft) writeLocal(draft.key, { data, savedAt: Date.now() });
    setFailure(res?.status === 401 ? "session" : "network");
  }

  const v = values;
  const e = errors;

  return (
    <form key={formKey} ref={formRef} onSubmit={onSubmit} onChange={onChange} className="flex flex-col gap-6">
      {draft && (
        <p className="-mt-4 text-right text-xs text-muted-foreground" aria-live="polite">
          {saveState === "saved" ? t("draftSaved") : saveState === "saving" ? t("draftSaving") : " "}
        </p>
      )}
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

      {failure && (
        <div role="alert" className="flex flex-col gap-3 rounded-lg bg-destructive/10 p-4 text-sm">
          <p className="text-destructive">{t(failure === "session" ? "failSession" : "failNetwork")}</p>
          {failure === "session" ? (
            // Re-login keeps the draft (device copy); Mini App users re-enter via /tg.
            <Link
              href={window.Telegram?.WebApp?.initData ? "/tg" : "/login"}
              className="self-start font-medium underline"
            >
              {t("loginAgain")}
            </Link>
          ) : (
            <Button type="submit" variant="outline" className="h-11 self-start">
              {tc("retry")}
            </Button>
          )}
        </div>
      )}

      <Button type="submit" disabled={pending} className="h-11 text-base sm:self-start sm:px-8">
        {pending ? tc("saving") : tc("save")}
      </Button>
    </form>
  );
}
