"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Chip, clayInput, Display, Panel } from "@/components/clay";
import { BackAction, MainAction } from "@/components/telegram-actions";
import { useRouter } from "@/i18n/navigation";
import { BUDGET_BANDS, TRAVEL_STYLES } from "@/lib/catalog";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";
import { Switch } from "../../new/wizard";

type When = "this_month" | "next_month" | "exact";
type Initial = {
  start: string;
  end: string;
  flex: boolean;
  size: number;
  band: string;
  styles: string[];
  womenOnly: boolean;
  note: string;
};

export function EditTripForm({
  tripId,
  locale,
  today,
  title,
  initial,
  minSize,
  canWomenOnly,
  womenOnlyOn,
}: {
  tripId: string;
  locale: string;
  today: string;
  title: string;
  initial: Initial;
  minSize: number;
  canWomenOnly: boolean;
  womenOnlyOn: boolean;
}) {
  const t = useTranslations("create");
  const to = useTranslations("onboarding");
  const ts = useTranslations("styles");
  const te = useTranslations("errors");
  const router = useRouter();
  const [when, setWhen] = useState<When>("exact");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [flex, setFlex] = useState(initial.flex);
  const [size, setSize] = useState(Math.max(initial.size, minSize));
  const [band, setBand] = useState(initial.band);
  const [styles, setStyles] = useState(initial.styles);
  const [womenOnly, setWomenOnly] = useState(initial.womenOnly);
  const [note, setNote] = useState(initial.note);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const okDates = when !== "exact" || (start >= today && end >= start);

  async function save() {
    if (pending || !okDates) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/trips/${tripId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        when,
        startDate: when === "exact" ? start : undefined,
        endDate: when === "exact" ? end : undefined,
        flex,
        size,
        band,
        styles,
        womenOnly,
        note: note || undefined,
      }),
    }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      haptic.success();
      router.push(`/trips/${tripId}`);
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
      <div className="relative flex min-h-11 flex-col items-center justify-center px-20 text-center">
        <BackAction
          label={t("cancel")}
          onClick={() => router.push(`/trips/${tripId}`)}
          className="absolute top-1/2 left-0 min-h-11 -translate-y-1/2 px-1 text-[15px] font-medium text-blue"
        />
        <span className="leading-tight font-semibold">{t("editTitle")}</span>
      </div>
      <Display className="px-1 pt-1 text-[32px]">{title}</Display>
      <p className="px-1 text-[13px] text-muted-foreground">{t("destinationFixed")}</p>

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
        {when === "exact" && (
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
        )}
        <Switch on={flex} onChange={setFlex} label={t("flex")} />
        <p className="text-[13px] text-muted-foreground">{t("membersNotified")}</p>
      </Panel>

      <Panel className="flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-semibold">{t("size")}</div>
          <div className="text-sm text-muted-foreground">
            {minSize > 3 ? t("sizeFloor", { n: minSize }) : t("sizeHint")}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="−"
            onClick={() => setSize(Math.max(minSize, size - 1))}
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
      </Panel>

      <Panel className="flex flex-col gap-3">
        <div className="text-lg font-semibold">{t("what")}</div>
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
        {(canWomenOnly || womenOnlyOn) && (
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
      {error && (
        <p role="alert" className="rounded-[18px] bg-danger-soft p-4 text-sm text-danger">
          {error === "network" ? t("network") : te(error as "invalid")}
        </p>
      )}
      <MainAction label={t("save")} onClick={save} loading={pending} disabled={!okDates} />
    </>
  );
}
