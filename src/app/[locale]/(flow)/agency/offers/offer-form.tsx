"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Chip, clayInput, Display, Panel } from "@/components/clay";
import { BackAction, MainAction } from "@/components/telegram-actions";
import { useRouter } from "@/i18n/navigation";
import { type Option, TRAVEL_STYLES } from "@/lib/catalog";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

export type OfferValues = {
  title: string;
  destinationCountry: string;
  destinationCity: string;
  startDate: string;
  endDate: string;
  price: string;
  seats: string;
  includes: string;
  excludes: string;
  itinerary: string; // one day per line: "Title: text"
  refundPolicy: string;
  description: string;
  travelStyles: string[];
};

const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export function OfferForm({
  tripId,
  initial,
  countries,
  today,
}: {
  tripId?: string;
  initial: OfferValues;
  countries: Option[];
  today: string;
}) {
  const t = useTranslations("agency");
  const ts = useTranslations("styles");
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof OfferValues) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });

  async function save() {
    setPending(true);
    setError(null);
    const offer = {
      title: v.title,
      destinationCountry: v.destinationCountry,
      destinationCity: v.destinationCity,
      startDate: v.startDate,
      endDate: v.endDate,
      price: Number(v.price),
      currency: "USD",
      seats: Number(v.seats),
      includes: lines(v.includes),
      excludes: lines(v.excludes),
      itinerary: lines(v.itinerary).map((l) => {
        const i = l.indexOf(":");
        return i > 0
          ? { title: l.slice(0, i).trim(), text: l.slice(i + 1).trim() }
          : { title: l.slice(0, 80), text: "" };
      }),
      refundPolicy: v.refundPolicy,
      description: v.description,
      travelStyles: v.travelStyles,
    };
    const res = await fetch("/api/agency", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tripId ? { op: "offer.update", tripId, offer } : { op: "offer.create", offer }),
    }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      haptic.success();
      router.push("/agency");
      return;
    }
    haptic.error();
    const e = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "x";
    setError(
      e === "not_verified"
        ? t("errNotVerified")
        : e === "seats_below_booked"
          ? t("errSeats")
          : t("errGeneric"),
    );
  }

  const input = (k: keyof OfferValues, label: string, type = "text", extra: Record<string, unknown> = {}) => (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{label}</span>
      <input type={type} value={v[k] as string} onChange={set(k)} className={clayInput} {...extra} />
    </label>
  );
  const area = (k: keyof OfferValues, label: string, rows = 3) => (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{label}</span>
      <textarea
        value={v[k] as string}
        onChange={set(k)}
        rows={rows}
        className={cn(clayInput, "rounded-[18px] py-3")}
      />
    </label>
  );
  const ok =
    v.title.trim().length >= 5 &&
    v.startDate >= today &&
    v.endDate >= v.startDate &&
    Number(v.price) >= 1 &&
    Number(v.seats) >= 1;
  return (
    <>
      <div className="relative flex min-h-11 items-center justify-center px-20">
        <BackAction
          label={t("title")}
          onClick={() => router.push("/agency")}
          className="absolute top-1/2 left-0 min-h-11 -translate-y-1/2 px-1 text-[15px] font-medium text-blue"
        />
      </div>
      <Display className="px-1 pt-2 text-[32px]">{t("formTitle")}</Display>
      <Panel className="flex flex-col gap-3">
        {input("title", t("fTitle"), "text", { maxLength: 80 })}
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t("fCountry")}</span>
          <select value={v.destinationCountry} onChange={set("destinationCountry")} className={clayInput}>
            {countries.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        {input("destinationCity", t("fCity"))}
        <div className="grid grid-cols-2 gap-2">
          {input("startDate", t("fStart"), "date", { min: today })}
          {input("endDate", t("fEnd"), "date", { min: v.startDate || today })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          {input("price", t("fPrice"), "number", { min: 1, inputMode: "numeric" })}
          {input("seats", t("fSeats"), "number", { min: 1, inputMode: "numeric" })}
        </div>
        {area("includes", t("fIncludes"))}
        {area("excludes", t("fExcludes"))}
        {area("itinerary", t("fItinerary"), 5)}
        {area("refundPolicy", t("fRefund"))}
        {area("description", t("fDesc"))}
        <div className="flex flex-col gap-2">
          <span className="font-semibold">{t("fStyles")}</span>
          <div className="flex flex-wrap gap-2">
            {TRAVEL_STYLES.map((s) => (
              <Chip
                key={s}
                on={v.travelStyles.includes(s)}
                onClick={() =>
                  setV({
                    ...v,
                    travelStyles: v.travelStyles.includes(s)
                      ? v.travelStyles.filter((x) => x !== s)
                      : [...v.travelStyles, s],
                  })
                }
              >
                {ts(s)}
              </Chip>
            ))}
          </div>
        </div>
      </Panel>
      {error && (
        <p role="alert" className="rounded-[18px] bg-danger-soft p-4 text-sm text-danger">
          {error}
        </p>
      )}
      <MainAction label={t("saveOffer")} onClick={save} loading={pending} disabled={!ok} />
    </>
  );
}
