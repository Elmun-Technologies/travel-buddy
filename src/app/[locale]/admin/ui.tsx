"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { clayInput } from "@/components/clay";
import { useRouter } from "@/i18n/navigation";
import { COUNTRIES } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { AdminOp } from "@/modules/admin/schema";

export async function postAdmin(op: AdminOp) {
  const r = await fetch("/api/admin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(op),
  }).catch(() => null);
  return r?.ok
    ? null
    : (((await r?.json().catch(() => null)) as { error?: string; issues?: string[] } | null) ?? {
        error: "network",
      });
}

const btn = "min-h-10 rounded-full px-4 text-sm font-medium disabled:opacity-40";
const tones = {
  dark: "bg-ink text-white",
  danger: "bg-danger text-white",
  plain: "border border-input bg-card",
} as const;

/** One admin action; destructive ones ask "Ishonchingiz komilmi?" first (second tap). */
export function AdminButton({
  op,
  label,
  tone = "plain",
  confirm = false,
}: {
  op: AdminOp;
  label: string;
  tone?: keyof typeof tones;
  confirm?: boolean;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          if (confirm && !armed) return setArmed(true);
          setBusy(true);
          const err = await postAdmin(op);
          setBusy(false);
          setArmed(false);
          setError(!!err);
          if (!err) router.refresh();
        }}
        className={cn(btn, armed ? tones.danger : tones[tone])}
      >
        {armed ? t("sure") : label}
      </button>
      {error && <span className="text-xs text-danger">{t("failed")}</span>}
    </span>
  );
}

function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={cn("flex flex-col gap-1 text-[13px] font-semibold", wide && "sm:col-span-2")}>
      {label}
      {children}
    </label>
  );
}

/** Small form shell: grid of fields, Save, errors from the API (which fields are wrong). */
function AdminForm({
  build,
  children,
  submit,
}: {
  build: () => AdminOp | null;
  children: ReactNode;
  submit?: string;
}) {
  const t = useTranslations("admin");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-3 rounded-[18px] bg-background p-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const op = build();
        if (!op) return setError(t("fill"));
        setBusy(true);
        const err = await postAdmin(op);
        setBusy(false);
        if (err)
          return setError(err.issues?.length ? `${t("check")}: ${err.issues.join(", ")}` : t("failed"));
        setError(null);
        router.refresh();
      }}
    >
      {children}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button type="submit" disabled={busy} className={cn(btn, tones.dark, "min-h-11 px-6")}>
          {submit ?? t("save")}
        </button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));
const str = (v: string) => (v.trim() === "" ? null : v.trim());

export function CountrySelect({
  value,
  onChange,
  names,
}: {
  value: string;
  onChange: (v: string) => void;
  names: Record<string, string>;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={clayInput}>
      {COUNTRIES.map((c) => (
        <option key={c} value={c}>
          {names[c]} ({c})
        </option>
      ))}
    </select>
  );
}

export type VisaInitial = {
  destination: string;
  status: string;
  maxStayDays: number | null;
  visaName: string | null;
  documents: string[];
  notes: string | null;
  checkedAt: string;
  sourceUrl: string | null;
  embassyPhone: string | null;
  embassyUrl: string | null;
};

export function VisaForm({
  initial,
  names,
  today,
}: {
  initial?: VisaInitial;
  names: Record<string, string>;
  today: string;
}) {
  const t = useTranslations("admin");
  const [v, setV] = useState({
    destination: initial?.destination ?? "GE",
    status: initial?.status ?? "visa_free",
    maxStayDays: String(initial?.maxStayDays ?? ""),
    visaName: initial?.visaName ?? "",
    documents: (initial?.documents ?? []).join("\n"),
    notes: initial?.notes ?? "",
    checkedAt: initial?.checkedAt ?? today,
    sourceUrl: initial?.sourceUrl ?? "",
    embassyPhone: initial?.embassyPhone ?? "",
    embassyUrl: initial?.embassyUrl ?? "",
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <AdminForm
      build={() =>
        v.checkedAt
          ? {
              op: "visa.save",
              destination: v.destination as VisaInitial["destination"] as never,
              status: v.status as "visa_free",
              maxStayDays: num(v.maxStayDays),
              visaName: str(v.visaName),
              documents: v.documents
                .split("\n")
                .map((d) => d.trim())
                .filter(Boolean),
              notes: str(v.notes),
              checkedAt: v.checkedAt,
              sourceUrl: str(v.sourceUrl),
              embassyPhone: str(v.embassyPhone),
              embassyUrl: str(v.embassyUrl),
            }
          : null
      }
    >
      <Field label={t("country")}>
        {initial ? (
          <span className="py-3 text-base font-normal">{names[v.destination]}</span>
        ) : (
          <CountrySelect
            value={v.destination}
            onChange={(d) => setV({ ...v, destination: d })}
            names={names}
          />
        )}
      </Field>
      <Field label={t("visaStatus")}>
        <select value={v.status} onChange={set("status")} className={clayInput}>
          <option value="visa_free">{t("visa_free")}</option>
          <option value="evisa">{t("evisa")}</option>
          <option value="visa_required">{t("visa_required")}</option>
        </select>
      </Field>
      <Field label={t("maxStay")}>
        <input
          inputMode="numeric"
          value={v.maxStayDays}
          onChange={set("maxStayDays")}
          className={clayInput}
        />
      </Field>
      <Field label={t("visaName")}>
        <input
          value={v.visaName}
          onChange={set("visaName")}
          placeholder="Shengen vizasi"
          className={clayInput}
        />
      </Field>
      <Field label={t("notes")} wide>
        <input value={v.notes} onChange={set("notes")} placeholder={t("notesHint")} className={clayInput} />
      </Field>
      <Field label={t("documents")} wide>
        <textarea
          rows={4}
          value={v.documents}
          onChange={set("documents")}
          placeholder={t("documentsHint")}
          className={cn(clayInput, "py-3")}
        />
      </Field>
      <Field label={t("checkedAt")}>
        <input type="date" value={v.checkedAt} onChange={set("checkedAt")} className={clayInput} />
      </Field>
      <Field label={t("source")}>
        <input
          type="url"
          value={v.sourceUrl}
          onChange={set("sourceUrl")}
          placeholder="https://"
          className={clayInput}
        />
      </Field>
      <Field label={t("embassyPhone")}>
        <input
          value={v.embassyPhone}
          onChange={set("embassyPhone")}
          placeholder="+995 32 ..."
          className={clayInput}
        />
      </Field>
      <Field label={t("embassyUrl")}>
        <input
          type="url"
          value={v.embassyUrl}
          onChange={set("embassyUrl")}
          placeholder="https://"
          className={clayInput}
        />
      </Field>
    </AdminForm>
  );
}

export type AgencyInitial = {
  id: string;
  name: string;
  countries: string[];
  rating: number | null;
  priceMinor: number | null;
  note: string | null;
  contactUrl: string | null;
};

export function AgencyForm({ initial }: { initial?: AgencyInitial }) {
  const t = useTranslations("admin");
  const [v, setV] = useState({
    name: initial?.name ?? "",
    countries: (initial?.countries ?? []).join(", "),
    rating: initial?.rating == null ? "" : String(initial.rating),
    price: initial?.priceMinor == null ? "" : String(initial.priceMinor / 100),
    note: initial?.note ?? "",
    contactUrl: initial?.contactUrl ?? "",
  });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <AdminForm
      build={() =>
        v.name.trim() && v.countries.trim()
          ? {
              op: "agency.save",
              id: initial?.id ?? null,
              name: v.name.trim(),
              countries: v.countries
                .toUpperCase()
                .split(/[\s,]+/)
                .filter(Boolean) as never,
              rating: num(v.rating),
              price: num(v.price),
              note: str(v.note),
              contactUrl: str(v.contactUrl),
            }
          : null
      }
    >
      <Field label={t("agencyName")}>
        <input value={v.name} onChange={set("name")} className={clayInput} />
      </Field>
      <Field label={t("countries")}>
        <input
          value={v.countries}
          onChange={set("countries")}
          placeholder="DE, FR, IT"
          className={clayInput}
        />
      </Field>
      <Field label={t("rating")}>
        <input
          inputMode="decimal"
          value={v.rating}
          onChange={set("rating")}
          placeholder="4.8"
          className={clayInput}
        />
      </Field>
      <Field label={t("priceUsd")}>
        <input inputMode="decimal" value={v.price} onChange={set("price")} className={clayInput} />
      </Field>
      <Field label={t("note")}>
        <input
          value={v.note}
          onChange={set("note")}
          placeholder={t("agencyNoteHint")}
          className={clayInput}
        />
      </Field>
      <Field label={t("contact")}>
        <input
          type="url"
          value={v.contactUrl}
          onChange={set("contactUrl")}
          placeholder="https://t.me/..."
          className={clayInput}
        />
      </Field>
    </AdminForm>
  );
}

const ITEMS = ["flight", "stay", "food", "transport", "tours", "other"] as const;

export function PriceForm({ names }: { names: Record<string, string> }) {
  const t = useTranslations("admin");
  const [v, setV] = useState({
    destination: "GE",
    days: "7",
    roomType: "quad",
    p25: "",
    median: "",
    p75: "",
    sampleSize: "0",
  });
  const [items, setItems] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <AdminForm
      build={() =>
        v.median && v.p25 && v.p75
          ? {
              op: "price.save",
              destination: v.destination as never,
              days: Number(v.days),
              roomType: v.roomType as "quad",
              p25: num(v.p25)!,
              median: num(v.median)!,
              p75: num(v.p75)!,
              sampleSize: Number(v.sampleSize) || 0,
              items: ITEMS.flatMap((k) =>
                num(items[k] ?? "") != null ? [{ key: k, amount: num(items[k])! }] : [],
              ),
            }
          : null
      }
    >
      <Field label={t("country")}>
        <CountrySelect value={v.destination} onChange={(d) => setV({ ...v, destination: d })} names={names} />
      </Field>
      <Field label={t("days")}>
        <input inputMode="numeric" value={v.days} onChange={set("days")} className={clayInput} />
      </Field>
      <Field label={t("roomType")}>
        <select value={v.roomType} onChange={set("roomType")} className={clayInput}>
          {(["quad", "double", "single"] as const).map((r) => (
            <option key={r} value={r}>
              {t(`room_${r}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("sampleSize")}>
        <input inputMode="numeric" value={v.sampleSize} onChange={set("sampleSize")} className={clayInput} />
      </Field>
      {(["p25", "median", "p75"] as const).map((k) => (
        <Field key={k} label={t(k)}>
          <input inputMode="decimal" value={v[k]} onChange={set(k)} placeholder="$" className={clayInput} />
        </Field>
      ))}
      {ITEMS.map((k) => (
        <Field key={k} label={t(`item_${k}`)}>
          <input
            inputMode="decimal"
            value={items[k] ?? ""}
            onChange={(e) => setItems({ ...items, [k]: e.target.value })}
            placeholder="$"
            className={clayInput}
          />
        </Field>
      ))}
    </AdminForm>
  );
}

export function OfferForm({ tripId }: { tripId: string }) {
  const t = useTranslations("admin");
  const [v, setV] = useState({ title: "", detail: "", price: "" });
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });
  return (
    <AdminForm
      submit={t("addOffer")}
      build={() =>
        v.title.trim() && num(v.price) != null
          ? { op: "offer.add", tripId, title: v.title.trim(), detail: str(v.detail), price: num(v.price)! }
          : null
      }
    >
      <Field label={t("agencyName")}>
        <input value={v.title} onChange={set("title")} className={clayInput} />
      </Field>
      <Field label={t("pricePerPerson")}>
        <input
          inputMode="decimal"
          value={v.price}
          onChange={set("price")}
          placeholder="$"
          className={clayInput}
        />
      </Field>
      <Field label={t("offerDetail")} wide>
        <input
          value={v.detail}
          onChange={set("detail")}
          placeholder={t("offerDetailHint")}
          className={clayInput}
        />
      </Field>
    </AdminForm>
  );
}

const CREATOR_STATUS = ["joined", "tracking", "approved", "rejected", "paid"] as const;

/** 1M Safar: views read from Instagram by hand, then the decision. */
export function CreatorForm({
  id,
  status,
  views,
  note,
}: {
  id: string;
  status: string;
  views: number | null;
  note: string | null;
}) {
  const t = useTranslations("admin");
  const tc = useTranslations("creator");
  const [v, setV] = useState({ status, views: views?.toString() ?? "", note: note ?? "" });
  return (
    <AdminForm
      build={() => {
        const n = num(v.views.replace(/\s/g, ""));
        return n != null && !Number.isInteger(n)
          ? null
          : { op: "creator.set", id, status: v.status as "joined", views: n, note: str(v.note) };
      }}
    >
      <Field label={t("views")}>
        <input
          inputMode="numeric"
          value={v.views}
          onChange={(e) => setV({ ...v, views: e.target.value })}
          className={clayInput}
        />
      </Field>
      <Field label={t("status")}>
        <select
          value={v.status}
          onChange={(e) => setV({ ...v, status: e.target.value })}
          className={clayInput}
        >
          {CREATOR_STATUS.map((s) => (
            <option key={s} value={s}>
              {tc(`st_${s}`)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("note")} wide>
        <input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} className={clayInput} />
      </Field>
    </AdminForm>
  );
}
