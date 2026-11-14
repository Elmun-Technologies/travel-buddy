"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clayInput } from "@/components/clay";
import { todayISO } from "@/lib/catalog";
import { cn } from "@/lib/utils";

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Day | Month | Year selects instead of a calendar (owner feedback: paging years one by one,
 * and mis-taps changed the day). Years run newest→oldest starting at 18 years ago.
 * Calls onChange with "YYYY-MM-DD" once all three are picked, "" otherwise.
 */
export function BirthDate({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (iso: string) => void;
  invalid?: boolean;
}) {
  const t = useTranslations("onboarding");
  const months = t.raw("months") as string[];
  const monthsOf = t.raw("monthsOf") as string[];
  const [init] = useState(() => (value ? value.split("-").map(Number) : [0, 0, 0]));
  const [y, setY] = useState(init[0]);
  const [m, setM] = useState(init[1]);
  const [d, setD] = useState(init[2]);

  const thisYear = Number(todayISO().slice(0, 4));
  const years = Array.from({ length: 83 }, (_, i) => thisYear - 18 - i); // 18 … 100 years old
  const maxDay = y && m ? daysIn(y, m) : m ? daysIn(2000, m) : 31; // 2000: leap year → 29 Feb allowed

  function update(ny: number, nm: number, nd: number) {
    const max = ny && nm ? daysIn(ny, nm) : nm ? daysIn(2000, nm) : 31;
    const day = nd > max ? 0 : nd; // e.g. 31 → February: ask for the day again
    setY(ny);
    setM(nm);
    setD(day);
    const pad = (n: number) => String(n).padStart(2, "0");
    onChange(ny && nm && day ? `${ny}-${pad(nm)}-${pad(day)}` : "");
  }

  const select = cn(clayInput, "appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-8");
  const chevron = {
    backgroundImage:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235F5F5F' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_1.6fr_1.2fr] gap-2">
        <select
          id="birthDay"
          aria-label={t("day")}
          value={d || ""}
          onChange={(e) => update(y, m, Number(e.target.value))}
          className={select}
          style={chevron}
          aria-invalid={invalid}
        >
          <option value="">{t("day")}</option>
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <select
          id="birthMonth"
          aria-label={t("month")}
          value={m || ""}
          onChange={(e) => update(y, Number(e.target.value), d)}
          className={select}
          style={chevron}
          aria-invalid={invalid}
        >
          <option value="">{t("month")}</option>
          {months.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          id="birthYear"
          aria-label={t("year")}
          value={y || ""}
          onChange={(e) => update(Number(e.target.value), m, d)}
          className={select}
          style={chevron}
          aria-invalid={invalid}
        >
          <option value="">{t("year")}</option>
          {years.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      {y && m && d ? (
        <p className="text-sm font-medium" aria-live="polite">
          {t("birthSummary", { day: d, month: monthsOf[m - 1], year: y })}
        </p>
      ) : null}
    </div>
  );
}
