"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { Option } from "@/lib/catalog";
import { cn } from "@/lib/utils";

export type FeedQuery = {
  country?: string[];
  month?: string;
  date?: string;
  budget?: number;
  style?: string[];
};

type Panel = "country" | "when" | "budget" | "style" | null;

const chip =
  "press flex min-h-11 flex-none items-center rounded-full px-4 text-[13px] font-medium whitespace-nowrap";
const on = "bg-ink text-white";
const off = "border border-input bg-card text-ink";

function href(q: FeedQuery) {
  const p = new URLSearchParams({ all: "1" }); // explicit choice: don't prefill from the profile again
  if (q.country?.length) p.set("country", q.country.join(","));
  if (q.month) p.set("month", q.month);
  if (q.date) p.set("date", q.date);
  if (q.budget) p.set("budget", String(q.budget));
  if (q.style?.length) p.set("style", q.style.join(","));
  return `/trips?${p}`;
}

const toggle = (list: string[] | undefined, v: string) =>
  list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];

/**
 * Filter as chips (owner: no separate form). Each option is a real link — works before hydration;
 * with JS we navigate in a transition, show "searching…" and scroll smoothly to the results.
 */
export function FeedChips({
  q,
  countries,
  styles,
  months,
}: {
  q: FeedQuery;
  countries: Option[];
  styles: Option[];
  months: { thisMonth: Option; nextMonth: Option };
}) {
  const t = useTranslations("feed");
  const router = useRouter();
  const [open, setOpen] = useState<Panel>(null);
  const [pending, start] = useTransition();
  const wasPending = useRef(false);

  // A filter navigation just finished → glide to the results heading.
  useEffect(() => {
    if (wasPending.current && !pending)
      document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    wasPending.current = pending;
  }, [pending]);

  const go = (e: React.MouseEvent, to: string) => {
    e.preventDefault();
    setOpen(null); // owner: close the list after a pick
    start(() => router.push(to, { scroll: false }));
  };
  const opt = (label: string, to: string, active: boolean) => (
    <Link key={label} href={to} onClick={(e) => go(e, to)} className={cn(chip, active ? on : off)}>
      {label}
    </Link>
  );

  const nameOf = (list: Option[], v: string) => list.find((o) => o.value === v)?.label ?? v;
  const more = (n: number) => (n > 1 ? ` +${n - 1}` : "");
  const any = !q.country?.length && !q.month && !q.date && !q.budget && !q.style?.length;
  const whenLabel = q.date
    ? q.date.split("-").reverse().slice(0, 2).join(".")
    : q.month === months.thisMonth.value
      ? t("thisMonth")
      : q.month === months.nextMonth.value
        ? t("nextMonth")
        : null;

  const head = (p: Exclude<Panel, null>, label: string, active: boolean) => (
    <button
      type="button"
      aria-expanded={open === p}
      onClick={() => setOpen(open === p ? null : p)}
      className={cn(chip, active ? on : off, open === p && "ring-2 ring-blue")}
    >
      {label}
      <svg
        viewBox="0 0 24 24"
        className="ml-1 size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {opt(t("all"), "/trips?all=1", any)}
        {head(
          "country",
          q.country?.length ? nameOf(countries, q.country[0]) + more(q.country.length) : t("country"),
          !!q.country?.length,
        )}
        {head("when", whenLabel ?? t("when"), !!whenLabel)}
        {head("budget", q.budget ? `≤ $${q.budget}` : t("budget"), !!q.budget)}
        {head(
          "style",
          q.style?.length ? nameOf(styles, q.style[0]) + more(q.style.length) : t("style"),
          !!q.style?.length,
        )}
      </div>

      {open && (
        <div className="flex flex-wrap gap-1.5 rounded-[18px] bg-background p-3">
          {open === "country" &&
            countries.map((c) =>
              opt(
                c.label,
                href({ ...q, country: toggle(q.country, c.value) }),
                !!q.country?.includes(c.value),
              ),
            )}
          {open === "when" && (
            <>
              {opt(
                t("thisMonth"),
                href({ ...q, month: months.thisMonth.value, date: undefined }),
                q.month === months.thisMonth.value,
              )}
              {opt(
                t("nextMonth"),
                href({ ...q, month: months.nextMonth.value, date: undefined }),
                q.month === months.nextMonth.value,
              )}
              <form
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const d = new FormData(e.currentTarget).get("date");
                  if (typeof d === "string" && d)
                    go(e as unknown as React.MouseEvent, href({ ...q, date: d, month: undefined }));
                }}
              >
                <label className="sr-only" htmlFor="feed-date">
                  {t("exactDate")}
                </label>
                <input
                  id="feed-date"
                  name="date"
                  type="date"
                  defaultValue={q.date}
                  className={cn(chip, off, "px-3")}
                />
                <button type="submit" className={cn(chip, on)}>
                  {t("exactDate")}
                </button>
              </form>
              {opt(t("anyTime"), href({ ...q, month: undefined, date: undefined }), !whenLabel)}
            </>
          )}
          {open === "budget" &&
            [300, 600, 1000]
              .map((b) => opt(`≤ $${b}`, href({ ...q, budget: b }), q.budget === b))
              .concat(opt(t("anyBudget"), href({ ...q, budget: undefined }), !q.budget))}
          {open === "style" &&
            styles.map((s) =>
              opt(s.label, href({ ...q, style: toggle(q.style, s.value) }), !!q.style?.includes(s.value)),
            )}
        </div>
      )}

      {pending && (
        <p
          role="status"
          className="fixed inset-x-0 top-3 z-40 mx-auto w-fit rounded-full bg-ink px-4 py-2 text-sm text-white"
        >
          {t("searching")}
        </p>
      )}
    </div>
  );
}
