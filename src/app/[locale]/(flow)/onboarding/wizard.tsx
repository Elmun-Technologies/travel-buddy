"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckIcon,
  Chip,
  clayInput,
  Display,
  FieldBlock,
  Panel,
  Segmented,
  StepHeader,
} from "@/components/clay";
import { BackAction, MainAction } from "@/components/telegram-actions";
import { Link, useRouter } from "@/i18n/navigation";
import { LocaleSwitch } from "@/components/locale-switch";
import { ageOn, BUDGET_BANDS, type Option } from "@/lib/catalog";
import { haptic, openExternal, tg } from "@/lib/telegram-webapp";
import { BirthDate } from "./birth-date";
import { StyleCards } from "./style-cards";

// Onboarding in 4 steps (App-Onboarding.png): 01 about you · 02 style & group · 03 where & budget · 04 phone.
// Every change is saved to this device and to the server, so closing Telegram never loses answers.

type Gender = "" | "female" | "male";
type Values = {
  displayName: string;
  birthDate: string;
  gender: Gender;
  showGender: boolean;
  languages: string[];
  city: string;
  travelStyles: string[];
  groupPref: "mixed" | "women_only";
  dreamDestinations: string[];
  budgetBand: string | null;
};
type Draft = { data: Partial<Values> & { step?: number }; savedAt: number };
type Failure = "network" | "session" | null;

const TOTAL = 4;
const STEP_OF: Record<string, number> = {
  displayName: 1,
  birthDate: 1,
  gender: 1,
  languages: 1,
  city: 1,
  travelStyles: 2,
  groupPref: 2,
};

function readLocal(key: string): Draft | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as Draft | null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, d: Draft | null) {
  try {
    if (d) localStorage.setItem(key, JSON.stringify(d));
    else localStorage.removeItem(key);
  } catch {
    // storage blocked: the server copy still covers us
  }
}
const putDraft = (data: Draft["data"]) =>
  fetch("/api/onboarding/draft", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data),
  });

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function OnboardingWizard({
  draftKey,
  serverDraft,
  phoneVerified,
  bot,
  name,
  locale,
  languages,
  destinations,
}: {
  draftKey: string;
  serverDraft: { data: Record<string, unknown>; savedAt: number } | null;
  phoneVerified: boolean;
  bot: string;
  name: string;
  locale: string;
  languages: Option[];
  destinations: Option[];
}) {
  const t = useTranslations("onboarding");
  const te = useTranslations("errors");
  const router = useRouter();

  const initial: Values = {
    displayName: name,
    birthDate: "",
    gender: "",
    showGender: false,
    languages: [locale],
    city: "",
    travelStyles: [],
    groupPref: "mixed",
    dreamDestinations: [],
    budgetBand: null,
  };
  const fromServer = serverDraft?.data as Draft["data"] | undefined;
  const [v, setV] = useState<Values>({ ...initial, ...fromServer });
  const [step, setStep] = useState(Math.min(fromServer?.step ?? 1, 3));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<Failure>(null);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState<"idle" | "saving" | "saved">("idle");
  const [phone, setPhone] = useState<"idle" | "waiting" | "done" | "declined">(
    phoneVerified ? "done" : "idle",
  );
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // A newer copy on this device (offline save) wins over the server draft.
  useEffect(() => {
    const local = readLocal(draftKey);
    if (!local || local.savedAt <= (serverDraft?.savedAt ?? 0)) return;
    // localStorage exists only after hydration, so this one-time restore has to run in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setV((cur) => ({ ...cur, ...local.data }));
    if (local.data.step) setStep(Math.min(local.data.step, 3));
    void putDraft(local.data).catch(() => {});
  }, [draftKey, serverDraft]);

  // Web flow: the user verifies in the bot chat and comes back — pick that up on return.
  useEffect(() => {
    if (step !== 4 || phone === "done") return;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await fetch("/api/profile/phone", { cache: "no-store" }).catch(() => null);
      if (r?.ok && ((await r.json()) as { verified: boolean }).verified) setPhone("done");
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [step, phone]);

  /** Save now (before switching language: the next page reads the server draft). */
  async function flush() {
    clearTimeout(timer.current);
    const data = { ...v, step };
    writeLocal(draftKey, { data, savedAt: Date.now() });
    await putDraft(data).catch(() => {});
  }

  function persist(next: Values, nextStep = step) {
    const data = { ...next, step: nextStep };
    writeLocal(draftKey, { data, savedAt: Date.now() });
    setSaved("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const res = await putDraft(data).catch(() => null);
      setSaved(res?.ok ? "saved" : "idle");
    }, 600);
  }

  function set<K extends keyof Values>(k: K, value: Values[K]) {
    const next = { ...v, [k]: value };
    if (k === "gender" && value !== "female") next.groupPref = "mixed";
    setV(next);
    setErrors((e) => ({ ...e, [k]: "" }));
    persist(next);
  }

  function go(n: number) {
    setStep(n);
    persist(v, n);
    window.scrollTo({ top: 0 });
  }

  function check1() {
    const e: Record<string, string> = {};
    if (v.displayName.trim().length < 2) e.displayName = "too_short";
    if (!v.birthDate) e.birthDate = "required";
    else {
      const age = ageOn(v.birthDate);
      if (Number.isNaN(age) || age > 100) e.birthDate = "invalid";
      else if (age < 18) e.birthDate = "under_18";
    }
    if (!v.languages.length) e.languages = "required";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function submit() {
    if (pending) return;
    clearTimeout(timer.current);
    setPending(true);
    setFailure(null);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: v.displayName,
        birthDate: v.birthDate,
        gender: v.gender || null,
        showGender: v.showGender,
        city: v.city,
        country: "UZ",
        languages: v.languages,
        travelStyles: v.travelStyles,
        interests: [],
        bio: "",
        groupPref: v.groupPref,
        dreamDestinations: v.dreamDestinations,
        budgetBand: v.budgetBand,
      }),
    }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      writeLocal(draftKey, null);
      haptic.success();
      if (phone === "done") router.replace("/trips");
      else setStep(4);
      return;
    }
    haptic.error();
    if (res?.status === 422) {
      const errs = ((await res.json()) as { errors: Record<string, string> }).errors;
      setErrors(errs);
      setStep(Math.min(...Object.keys(errs).map((k) => STEP_OF[k] ?? 3)));
      return;
    }
    writeLocal(draftKey, { data: { ...v, step }, savedAt: Date.now() });
    setFailure(res?.status === 401 ? "session" : "network");
  }

  async function sharePhone() {
    const app = tg();
    if (!app?.requestContact) {
      openExternal(`https://t.me/${bot}?start=phone`); // Mini App: via openTelegramLink
      return;
    }
    app.requestContact((shared) => {
      if (!shared) return setPhone("declined");
      setPhone("waiting");
      // The bot receives the contact and marks the phone verified; poll until it has.
      let tries = 0;
      const iv = setInterval(async () => {
        const r = await fetch("/api/profile/phone", { cache: "no-store" }).catch(() => null);
        const ok = r?.ok && ((await r.json()) as { verified: boolean }).verified;
        if (ok || ++tries > 15) {
          clearInterval(iv);
          setPhone(ok ? "done" : "declined");
          if (ok) haptic.success();
        }
      }, 1000);
    });
  }

  const status = saved === "saved" ? t("saved") : saved === "saving" ? t("saving") : null;
  const err = (k: string) => (errors[k] ? te(errors[k]) : undefined);

  return (
    <>
      {step > 1 && step < 4 && <BackAction label={t("back")} onClick={() => go(step - 1)} />}
      {step === 1 && <LocaleSwitch beforeSwitch={flush} />}

      <Panel className="flex flex-col gap-3.5 p-5">
        <StepHeader step={step} total={TOTAL} status={status} />
        <Display className="text-[32px]">{t(`s${step}Title`)}</Display>
        <p className="text-sm leading-relaxed text-muted-foreground">{t(`s${step}Lead`)}</p>
      </Panel>

      {step === 1 && (
        <>
          <Panel className="flex flex-col gap-5">
            <FieldBlock
              label={t("name")}
              htmlFor="displayName"
              hint={t("nameHint")}
              error={err("displayName")}
            >
              <input
                id="displayName"
                value={v.displayName}
                maxLength={50}
                autoComplete="given-name"
                onChange={(e) => set("displayName", e.target.value)}
                className={clayInput}
                aria-invalid={!!errors.displayName}
              />
            </FieldBlock>
            <FieldBlock label={t("birth")} htmlFor="birthDay" hint={t("birthHint")} error={err("birthDate")}>
              <BirthDate
                value={v.birthDate}
                onChange={(iso) => set("birthDate", iso)}
                invalid={!!errors.birthDate}
              />
            </FieldBlock>
            <FieldBlock label={t("gender")} hint={t("genderHint")}>
              <Segmented<Gender>
                label={t("gender")}
                value={v.gender}
                onChange={(g) => {
                  haptic.select();
                  set("gender", g);
                }}
                options={[
                  { value: "female", label: t("female") },
                  { value: "male", label: t("male") },
                  { value: "", label: t("noGender") },
                ]}
              />
              {v.gender && (
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={v.showGender}
                    onChange={(e) => set("showGender", e.target.checked)}
                    className="size-5 accent-ink"
                  />
                  {t("showGender")}
                </label>
              )}
            </FieldBlock>
          </Panel>
          <Panel className="flex flex-col gap-5">
            <FieldBlock label={t("languages")} error={err("languages")}>
              <div className="flex flex-wrap gap-2">
                {languages.map((o) => (
                  <Chip
                    key={o.value}
                    on={v.languages.includes(o.value)}
                    onClick={() => {
                      haptic.select();
                      set("languages", toggle(v.languages, o.value));
                    }}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </FieldBlock>
            <FieldBlock label={t("city")} htmlFor="city">
              <input
                id="city"
                value={v.city}
                maxLength={60}
                placeholder={t("cityPlaceholder")}
                onChange={(e) => set("city", e.target.value)}
                className={clayInput}
              />
            </FieldBlock>
          </Panel>
        </>
      )}

      {step === 2 && (
        <>
          <Panel className="flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold">{t("styleLabel")}</div>
            <StyleCards
              selected={v.travelStyles}
              onToggle={(st) => {
                haptic.select();
                set("travelStyles", toggle(v.travelStyles, st));
              }}
            />
          </Panel>
          <Panel className="flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold">{t("groupLabel")}</div>
            <Segmented
              label={t("groupLabel")}
              value={v.groupPref}
              onChange={(g) => {
                haptic.select();
                set("groupPref", g);
              }}
              options={[
                { value: "mixed", label: t("groupMixed") },
                { value: "women_only", label: t("groupWomen"), disabled: v.gender !== "female" },
              ]}
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {errors.groupPref
                ? te(errors.groupPref)
                : v.gender === "female"
                  ? t("groupHint")
                  : t("groupHintNotFemale")}
            </p>
          </Panel>
          <Panel tone="soft" className="flex items-start gap-2.5 px-4 py-3.5">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="mt-px flex-none"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8h.01M11 12h1v5h1" />
            </svg>
            <p className="text-[13px] leading-relaxed">{t("privacyNote")}</p>
          </Panel>
        </>
      )}

      {step === 3 && (
        <>
          <Panel className="flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold">{t("destLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {destinations.map((o) => (
                <Chip
                  key={o.value}
                  on={v.dreamDestinations.includes(o.value)}
                  onClick={() => {
                    haptic.select();
                    set("dreamDestinations", toggle(v.dreamDestinations, o.value));
                  }}
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </Panel>
          <Panel className="flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold">{t("budgetLabel")}</div>
            <div className="flex flex-wrap gap-2">
              {BUDGET_BANDS.map((b) => (
                <Chip
                  key={b}
                  on={v.budgetBand === b}
                  onClick={() => {
                    haptic.select();
                    set("budgetBand", v.budgetBand === b ? null : b);
                  }}
                >
                  {t(`budget.${b}`)}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t("budgetHint")}</p>
          </Panel>
        </>
      )}

      {step === 4 && (
        <Panel className="flex flex-col gap-3">
          {(["s4p1", "s4p2", "s4p3"] as const).map((k) => (
            <div key={k} className="flex items-start gap-3 text-[15px]">
              <span className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-success-soft text-success">
                <CheckIcon />
              </span>
              {t(k)}
            </div>
          ))}
          {phone === "waiting" && (
            <p role="status" className="text-sm text-muted-foreground">
              {t("waiting")}
            </p>
          )}
          {phone === "done" && (
            <p role="status" className="text-sm font-medium text-success">
              {t("phoneDone")}
            </p>
          )}
          {phone === "declined" && <p className="text-sm text-muted-foreground">{t("notShared")}</p>}
          {phone !== "done" && (
            <Link href="/trips" className="min-h-11 self-start py-2.5 text-sm font-medium text-blue">
              {t("later")}
            </Link>
          )}
        </Panel>
      )}

      {failure && (
        <Panel tone="light" role="alert" className="flex flex-col gap-3 bg-danger-soft">
          <p className="text-sm text-danger">{t(failure === "session" ? "failSession" : "failNetwork")}</p>
          {failure === "session" ? (
            <Link href={tg() ? "/tg" : "/login"} className="self-start text-sm font-medium underline">
              {t("loginAgain")}
            </Link>
          ) : (
            <p className="text-xs text-muted-foreground">{t("retryHint")}</p>
          )}
        </Panel>
      )}

      {step === 1 && <MainAction label={t("next")} onClick={() => check1() && go(2)} />}
      {step === 2 && (
        <MainAction
          label={v.travelStyles.length ? t("nextCount", { n: v.travelStyles.length }) : t("next")}
          onClick={() => go(3)}
        />
      )}
      {step === 3 && (
        <MainAction label={failure ? t("retry") : t("save")} onClick={submit} loading={pending} />
      )}
      {step === 4 && (
        <MainAction
          label={phone === "done" ? t("finish") : tg()?.requestContact ? t("share") : t("openBot")}
          onClick={() => (phone === "done" ? router.replace("/trips") : sharePhone())}
          loading={phone === "waiting"}
        />
      )}
    </>
  );
}
