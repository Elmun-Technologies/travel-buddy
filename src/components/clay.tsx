// "Clay" building blocks (docs/design-system.md). Plain components: usable from server and client.
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "light" | "dark" | "blue" | "signal" | "soft";
const tones: Record<Tone, string> = {
  light: "bg-card text-foreground",
  dark: "bg-ink text-white",
  blue: "bg-blue text-white",
  signal: "bg-signal text-ink",
  soft: "bg-blue-soft text-blue-ink",
};

/** Rounded bento panel: one idea per panel. */
export function Panel({ tone = "light", className, ...p }: ComponentProps<"section"> & { tone?: Tone }) {
  return <section className={cn("rounded-panel p-4 md:p-6", tones[tone], className)} {...p} />;
}

/** Big light heading (Inter Tight, -0.03em, 1.02). */
export function Display({
  as: Tag = "h1",
  className,
  ...p
}: ComponentProps<"h1"> & { as?: "h1" | "h2" | "h3" | "span" | "div" }) {
  return <Tag className={cn("font-display", className)} {...p} />;
}

/** Small capsule label ("Bepul · 18+", "✓ Telefon tasdiqlangan"). */
export function Tag({
  tone = "outline",
  className,
  ...p
}: ComponentProps<"span"> & { tone?: "outline" | "soft" | "dark" | "signal" }) {
  const t = {
    outline: "border border-input bg-card text-foreground",
    soft: "bg-blue-soft text-blue-ink",
    dark: "bg-ink text-white",
    signal: "bg-signal text-ink",
  }[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        t,
        className,
      )}
      {...p}
    />
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-3.5", className)}
    >
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      <path d="M7 17L17 7M8 7h9v9" />
    </svg>
  );
}

/** Round "↗" — signal yellow by default. Decorative unless given a label. */
export function ArrowBadge({
  tone = "signal",
  className,
}: {
  tone?: "signal" | "white";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex size-12 flex-none items-center justify-center rounded-full",
        tone === "signal" ? "bg-signal text-ink" : "bg-white text-ink",
        className,
      )}
    >
      <ArrowIcon />
    </span>
  );
}

/** "02 / 04" + progress bars + optional status on the right. */
export function StepHeader({ step, total, status }: { step: number; total: number; status?: ReactNode }) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between">
        <span className="font-display text-xl">
          {pad(step)} <span className="text-[#9a9a9a]">/ {pad(total)}</span>
        </span>
        <span className="text-[13px] text-muted-foreground" aria-live="polite">
          {status}
        </span>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={cn("h-1 rounded-full", i < step ? "bg-ink" : "bg-line")} />
        ))}
      </div>
    </div>
  );
}

/** Toggle chip (multi-select): filled black when on. 44px tall. */
export function Chip({ on, className, ...p }: ComponentProps<"button"> & { on: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={cn(
        "press min-h-11 rounded-full border px-4 text-sm font-medium transition-colors",
        on ? "border-ink bg-ink text-white" : "border-input bg-card text-foreground",
        className,
      )}
      {...p}
    />
  );
}

/** Segmented control (single choice) on a grey track. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1.5 rounded-lg bg-background p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-h-11 rounded-md px-2 text-sm transition-colors disabled:opacity-40",
            value === o.value ? "bg-card font-semibold text-foreground" : "font-medium text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Field label + control + hint/error, design spacing. */
export function FieldBlock({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[13px] font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export const clayInput =
  "min-h-12 w-full rounded-lg border border-input bg-card px-4 text-base outline-none focus-visible:border-blue focus-visible:ring-3 focus-visible:ring-blue/20 aria-invalid:border-danger";

export const bigButtonClass =
  "press flex min-h-[52px] w-full items-center justify-center rounded-button bg-ink px-4 text-base font-semibold text-white disabled:opacity-50";

/** Main action outside Telegram (inside, the native MainButton is used — see MainAction). */
export function BigButton({ className, ...p }: ComponentProps<"button">) {
  return <button className={cn(bigButtonClass, className)} {...p} />;
}
