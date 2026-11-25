"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { CheckIcon, Chip, clayInput, Display, Panel } from "@/components/clay";
import { BackAction, MainAction } from "@/components/telegram-actions";
import { ShareList } from "@/components/trips/share";
import { useRouter } from "@/i18n/navigation";
import { BUDGET_BANDS, type Option, TRAVEL_STYLES } from "@/lib/catalog";
import { playCountry } from "@/lib/music";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

export type Tile = { country: string; city?: string; label: string; photo: string };
type When = "this_month" | "next_month" | "exact";
type Created = { id: string; code: string; title: string; meta: string };

const DAY = 86_400_000;
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY) + 1;

function Steps({ step }: { step: number }) {
  return (
    <div className="grid grid-cols-3 gap-1" aria-hidden="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className={cn("h-1 rounded-full", i <= step ? "bg-ink" : "bg-line")} />
      ))}
    </div>
  );
}

export function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left text-[15px]"
    >
      {label}
      <span
        className={cn(
          "flex h-8 w-14 flex-none items-center rounded-full p-1 transition-colors",
          on ? "bg-ink" : "bg-line",
        )}
      >
        <span className={cn("size-6 rounded-full bg-white transition-transform", on && "translate-x-6")} />
      </span>
    </button>
  );
}

export function CreateWizard({
  locale,
  today,
  tiles,
  countries,
  initialCountry,
  styles: profileStyles,
  canWomenOnly,
  bot,
  clubId,
}: {
  locale: string;
  today: string;
  tiles: Tile[];
  countries: Option[];
  initialCountry: string | null;
  styles: string[];
  canWomenOnly: boolean;
  bot: string;
  clubId?: string;
}) {
  const t = useTranslations("create");
  const to = useTranslations("onboarding");
  const ts = useTranslations("styles");
  const te = useTranslations("errors");
  const router = useRouter();
  const months = to.raw("months") as string[];
  const monthsOf = to.raw("monthsOf") as string[];

  const [step, setStep] = useState(1);
  const [place, setPlace] = useState<{
    country: string;
    city?: string;
    label: string;
    photo?: string;
  } | null>(() => {
    const tile = tiles.find((x) => x.country === initialCountry && !x.city);
    if (tile) return tile;
    const c = countries.find((x) => x.value === initialCountry);
    return c ? { country: c.value, label: c.label } : null;
  });
  const [query, setQuery] = useState("");
  const [when, setWhen] = useState<When>("next_month");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [flex, setFlex] = useState(true);
  const [size, setSize] = useState(6);
  const [band, setBand] = useState<(typeof BUDGET_BANDS)[number]>("300_600");
  const [styles, setStyles] = useState<string[]>(profileStyles.slice(0, 3));
  const [womenOnly, setWomenOnly] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const m = Number(today.split("-")[1]);
  const monthIdx = (offset: number) => (m - 1 + offset) % 12;
  const exactOk = when !== "exact" || (start >= today && end >= start && days(start, end) <= 90);
  const dateLabel = useMemo(() => {
    if (when === "this_month") return months[monthIdx(0)];
    if (when === "next_month") return months[monthIdx(1)];
    if (!start || !end) return "";
    const p = (iso: string) => {
      const [, mm, dd] = iso.split("-").map(Number);
      return { d: dd, m: monthsOf[mm - 1] };
    };
    const a = p(start);
    const b = p(end);
    return `${t("range", { d1: a.d, m1: a.m, d2: b.d, m2: b.m })} · ${t("days", { n: days(start, end) })}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, start, end]);
  const matches = query.trim()
    ? countries.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];
  const photo = place?.photo ?? tiles.find((x) => x.country === place?.country)?.photo ?? "hike-group";

  async function submit() {
    if (!place || pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        country: place.country,
        city: place.city,
        when,
        startDate: when === "exact" ? start : undefined,
        endDate: when === "exact" ? end : undefined,
        flex,
        size,
        band,
        styles,
        womenOnly,
        note: note || undefined,
        clubId,
      }),
    }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      haptic.celebrate(); // the trip is open: the biggest moment of the flow
      setCreated((await res.json()) as Created);
      setStep(3);
      window.scrollTo({ top: 0 });
      return;
    }
    haptic.error();
    const data = res
      ? ((await res.json().catch(() => ({}))) as { error?: string; errors?: Record<string, string> })
      : {};
    setError(data.error ?? Object.values(data.errors ?? {})[0] ?? "network");
  }

  return (
    <>
      <div className="flex flex-col gap-2 px-1">
        <div className="relative flex min-h-11 flex-col items-center justify-center px-20 text-center">
          {step === 1 && (
            <BackAction
              label={t("cancel")}
              onClick={() => router.push("/trips")}
              className="absolute top-1/2 left-0 min-h-11 -translate-y-1/2 px-1 text-[15px] font-medium text-blue"
            />
          )}
          {step === 2 && (
            <BackAction
              label={to("back")}
              onClick={() => setStep(1)}
              className="absolute top-1/2 left-0 min-h-11 -translate-y-1/2 px-1 text-[15px] font-medium text-blue"
            />
          )}
          {step === 3 && created && (
            <BackAction
              label={t("close")}
              onClick={() => router.push(`/trips/${created.id}`)}
              className="absolute top-1/2 left-0 min-h-11 -translate-y-1/2 px-1 text-[15px] font-medium text-blue"
            />
          )}
          <span className="leading-tight font-semibold">{step < 3 ? t("newTrip") : t("ready")}</span>
          <span className="text-xs text-muted-foreground">{step} / 3</span>
        </div>
        <Steps step={step} />
      </div>

      {step === 1 && (
        <>
          <Display className="px-1 pt-3 text-[40px]">{t("s1Title")}</Display>
          <label htmlFor="trip-search" className="sr-only">
            {t("search")}
          </label>
          <input
            id="trip-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            className={cn(clayInput, "rounded-full")}
          />
          {matches.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {matches.map((c) => (
                <Chip
                  key={c.value}
                  on={place?.country === c.value && !place.city}
                  onClick={() => {
                    playCountry(c.value); // the country's own little tune
                    setPlace({ country: c.value, label: c.label });
                    setQuery("");
                  }}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            {tiles.map((tile) => {
              const on = place?.country === tile.country && place.city === tile.city;
              return (
                <button
                  key={tile.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    playCountry(tile.country);
                    setPlace(tile);
                  }}
                  className={cn(
                    "press lift relative h-[140px] overflow-hidden rounded-[18px] border-[3px]",
                    on ? "border-ink" : "border-transparent",
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP */}
                  <img
                    src={`/photos/${tile.photo}-400.webp`}
                    alt=""
                    className="pointer-events-none absolute inset-0 size-full object-cover"
                  />
                  <span className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,.55))]" />
                  <span className="absolute bottom-3 left-3 text-[17px] font-semibold text-white">
                    {tile.label}
                  </span>
                  {on && (
                    <span className="absolute top-2.5 right-2.5 flex size-8 items-center justify-center rounded-full bg-ink text-white">
                      <CheckIcon className="size-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Panel className="flex flex-col gap-3">
            <div className="text-lg font-semibold">{t("when")}</div>
            <div className="flex flex-wrap gap-2">
              {(["this_month", "next_month", "exact"] as const).map((w) => (
                <Chip
                  key={w}
                  on={when === w}
                  onClick={() => {
                    haptic.select();
                    setWhen(w);
                  }}
                >
                  {t(`when_${w}`)}
                </Chip>
              ))}
            </div>
            {when === "exact" ? (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  aria-label={t("start")}
                  min={today}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={clayInput}
                />
                <input
                  type="date"
                  aria-label={t("end")}
                  min={start || today}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={clayInput}
                />
              </div>
            ) : null}
            {dateLabel && (
              <div className="rounded-[14px] bg-background px-4 py-3.5 text-lg font-semibold">
                {dateLabel}
              </div>
            )}
            <Switch on={flex} onChange={setFlex} label={t("flex")} />
          </Panel>
          <MainAction
            label={t("next")}
            onClick={() => setStep(2)}
            disabled={!place || !exactOk || (when === "exact" && !dateLabel)}
          />
        </>
      )}

      {step === 2 && place && (
        <>
          <Panel className="flex items-center gap-3 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP */}
            <img
              src={`/photos/${photo}-400.webp`}
              alt=""
              className="size-[72px] flex-none rounded-[14px] object-cover"
            />
            <div className="min-w-0 flex-1">
              <div className="text-lg font-semibold">{place.label}</div>
              <div className="text-sm text-muted-foreground">{dateLabel}</div>
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="min-h-11 text-sm font-medium underline underline-offset-4"
            >
              {t("change")}
            </button>
          </Panel>
          <Display className="px-1 pt-2 text-[40px]">{t("s2Title")}</Display>
          <Panel className="flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">{t("size")}</div>
              <div className="text-sm text-muted-foreground">{t("sizeHint")}</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label="−"
                onClick={() => setSize(Math.max(3, size - 1))}
                className="flex size-12 items-center justify-center rounded-full border border-input"
              >
                <Minus className="size-5" aria-hidden="true" />
              </button>
              <span className="w-8 text-center font-display text-3xl" aria-live="polite">
                {size}
              </span>
              <button
                type="button"
                aria-label="+"
                onClick={() => setSize(Math.min(20, size + 1))}
                className="flex size-12 items-center justify-center rounded-full border border-input"
              >
                <Plus className="size-5" aria-hidden="true" />
              </button>
            </div>
          </Panel>
          <Panel className="flex flex-col gap-3">
            <div className="text-lg font-semibold">{t("budget")}</div>
            <div className="flex flex-wrap gap-2">
              {BUDGET_BANDS.map((b) => (
                <Chip
                  key={b}
                  on={band === b}
                  onClick={() => {
                    haptic.select();
                    setBand(b);
                  }}
                >
                  {to(`budget.${b}`)}
                </Chip>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{to("budgetHint")}</p>
          </Panel>
          <Panel className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-lg font-semibold">{t("what")}</div>
              {profileStyles.length > 0 && (
                <div className="text-xs text-muted-foreground">{t("fromProfile")}</div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {TRAVEL_STYLES.map((s) => (
                <Chip
                  key={s}
                  on={styles.includes(s)}
                  onClick={() => {
                    haptic.select();
                    setStyles(styles.includes(s) ? styles.filter((x) => x !== s) : [...styles, s]);
                  }}
                >
                  {ts(s)}
                </Chip>
              ))}
            </div>
            {canWomenOnly && (
              <div className="border-t border-line pt-2">
                <Switch on={womenOnly} onChange={setWomenOnly} label={t("womenOnly")} />
              </div>
            )}
          </Panel>
          <label htmlFor="trip-note" className="sr-only">
            {t("note")}
          </label>
          <textarea
            id="trip-note"
            rows={3}
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("note")}
            className={cn(clayInput, "min-h-24 rounded-[18px] py-3")}
          />
          <p className="px-1 text-[13px] text-muted-foreground">{t("later")}</p>
          {error && (
            <p role="alert" className="rounded-[18px] bg-danger-soft p-4 text-sm text-danger">
              {error === "network" ? t("network") : te(error)}
            </p>
          )}
          <MainAction label={t("open")} onClick={submit} loading={pending} />
        </>
      )}

      {step === 3 && created && place && (
        <>
          <Display className="px-1 pt-3 text-[40px]">{t("s3Title")}</Display>
          <p className="px-1 text-[17px] text-muted-foreground">{t("s3Lead")}</p>
          <div className="overflow-hidden rounded-[22px] bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP */}
            <img src={`/photos/${photo}-1200.webp`} alt="" className="h-[200px] w-full object-cover" />
            <div className="flex flex-col gap-2 p-4">
              <Display as="div" className="text-[28px]">
                {created.title}
              </Display>
              <div className="text-sm text-muted-foreground">{created.meta}</div>
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-[13px] text-muted-foreground">{t("preview")}</span>
                <span className="flex-none rounded-full bg-ink px-4 py-2 text-sm font-semibold whitespace-nowrap text-white">
                  {t("imIn")}
                </span>
              </div>
            </div>
          </div>
          <ShareList
            tripId={created.id}
            title={created.title}
            tgLink={bot ? `https://t.me/${bot}?startapp=trip_${created.code}` : null}
            webLink={`${window.location.origin}/${locale}/t/${created.code}`}
          />
          <Panel tone="soft" className="text-[15px]">
            {t("weHelp", { place: place.label })}
          </Panel>
          <MainAction label={t("toRoom")} href={`/trips/${created.id}/room`} />
        </>
      )}
    </>
  );
}
