"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function Field({
  label,
  name,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations("errors");
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="text-sm text-destructive">
          {t(error)}
        </p>
      )}
    </div>
  );
}

export function ChipGroup({
  legend,
  name,
  options,
  selected = [],
  error,
}: {
  legend: string;
  name: string;
  options: { value: string; label: string }[];
  selected?: readonly string[];
  error?: string;
}) {
  const t = useTranslations("errors");
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label
            key={o.value}
            className="cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring"
          >
            <input
              type="checkbox"
              name={name}
              value={o.value}
              defaultChecked={selected.includes(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{t(error)}</p>}
    </fieldset>
  );
}

export function FormError({ code }: { code?: string }) {
  const t = useTranslations("errors");
  if (!code) return null;
  return (
    <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
      {t(code)}
    </p>
  );
}
