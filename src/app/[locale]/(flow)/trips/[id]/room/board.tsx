"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import { ArrowUpRight, Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Display, Panel, clayInput } from "@/components/clay";
import { ExternalLink } from "@/components/external-link";
import { Link } from "@/i18n/navigation";
import { MainAction } from "@/components/telegram-actions";
import { haptic, openExternal } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";
import type { Board as BoardData } from "@/modules/board/service";
import type { BoardOp } from "@/modules/board/schema";

const tones = ["bg-[#cfdae6]", "bg-[#e8dccb]", "bg-[#d6e6d3]", "bg-[#ead3e0]", "bg-[#d3e8e6]"];
export const toneOf = (id: string | null) => tones[(id?.charCodeAt(0) ?? 0) % tones.length];

export type BoardTrip = {
  destination: string;
  startDate: string;
  startLabel: string;
  deadlineLabel: string | null;
  today: string;
  deadline: string | null;
  flightUrl: string | null;
  photo: string;
  currency: string;
  familyToken: string | null;
  price: { country: string; days: number; median: number } | null;
  tripId: string;
};
type Props = {
  tab: "plan" | "book" | "costs";
  tripId: string;
  me: string;
  isOwner: boolean;
  version: number;
  trip: BoardTrip;
};
type Act = (op: BoardOp) => Promise<boolean>;

const eyebrow = "text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase";
const linkBtn = "min-h-11 text-[15px] underline underline-offset-4";
const pill = "min-h-11 rounded-full border border-input px-4 text-sm font-medium";

/** Reja / Yig'amiz / Xarajat. Data comes from /board; any member's change refetches via the room stream. */
export function Board({ tab, tripId, me, isOwner, version, trip }: Props) {
  const t = useTranslations("board");
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/rooms/${tripId}/board`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setData((await r.json()) as BoardData);
  }, [tripId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount and on every live "board" event
    void load();
  }, [load, version]);

  const act: Act = async (op) => {
    const r = await fetch(`/api/rooms/${tripId}/board`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(op),
    }).catch(() => null);
    setError(!r?.ok);
    if (r?.ok) {
      haptic.select();
      await load();
    }
    return !!r?.ok;
  };

  if (!data) return <p className="py-10 text-center text-muted-foreground">{t("loading")}</p>;
  const name = (id: string) => (id === me ? t("you") : (data.members.find((m) => m.id === id)?.name ?? "—"));
  const money = (minor: number | null) =>
    minor == null
      ? ""
      : new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: trip.currency,
          currencyDisplay: "narrowSymbol",
          maximumFractionDigits: minor % 100 ? 2 : 0,
        }).format(minor / 100);
  const p = { data, act, me, isOwner, trip, name, money };
  return (
    <>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {t("failed")}
        </p>
      )}
      {tab === "plan" && <PlanTab {...p} />}
      {tab === "book" && <BookTab {...p} />}
      {tab === "costs" && <CostsTab {...p} />}
    </>
  );
}

type TabProps = {
  data: BoardData;
  act: Act;
  me: string;
  isOwner: boolean;
  trip: BoardTrip;
  name: (id: string) => string;
  money: (minor: number | null) => string;
};

// ---------- Reja ----------

function PlanTab({ data, act, isOwner, trip }: TabProps) {
  const t = useTranslations("board");
  const [adding, setAdding] = useState(false);
  const [checkText, setCheckText] = useState("");
  const done = data.checklist.filter((c) => c.done).length;
  const label = (l: string) => (l.startsWith("k:") ? t(`check_${l.slice(2)}` as "check_passport") : l);

  return (
    <>
      <Panel className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className={eyebrow}>{t("planTitle")}</h2>
          <button type="button" onClick={() => setAdding(!adding)} className={linkBtn}>
            {isOwner ? t("addDay") : t("propose")}
          </button>
        </div>
        {adding && (
          <PlanForm
            next={Math.max(0, ...data.plan.map((p) => p.day)) + 1}
            hint={isOwner ? null : t("proposeHint")}
            onCancel={() => setAdding(false)}
            onSave={async (v) => (await act({ op: "plan.add", ...v })) && setAdding(false)}
          />
        )}
        {data.plan.length === 0 && !adding && <p className="text-muted-foreground">{t("planEmpty")}</p>}
        <ol className="flex flex-col">
          {data.plan.map((p, i) => (
            <li key={p.id} className="relative flex gap-4 pb-6 last:pb-0">
              <span
                aria-hidden="true"
                className={cn(
                  "relative z-10 mt-1.5 size-[22px] flex-none rounded-full border-[3px] border-ink",
                  i === 0 ? "bg-ink" : "bg-card",
                )}
              />
              {i < data.plan.length - 1 && (
                <span aria-hidden="true" className="absolute top-7 bottom-0 left-[10px] w-[3px] bg-line" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <Display as="h3" className="text-[30px] leading-none">
                    {t("day", { n: p.day })}
                  </Display>
                  <span className="text-xl font-semibold">{p.place}</span>
                  {p.proposed && (
                    <span className="rounded-full bg-signal px-2 py-0.5 text-xs font-semibold">
                      {t("proposal")}
                    </span>
                  )}
                </div>
                {p.note && <p className="text-[15px] text-muted-foreground">{p.note}</p>}
                {p.proposed && isOwner && (
                  <button
                    type="button"
                    onClick={() => act({ op: "plan.accept", id: p.id })}
                    className={cn(linkBtn, "self-start text-blue")}
                  >
                    {t("accept")}
                  </button>
                )}
              </div>
              {(p.mine || isOwner) && (
                <button
                  type="button"
                  aria-label={`${t("remove")}: ${t("day", { n: p.day })}`}
                  onClick={() => act({ op: "plan.remove", id: p.id })}
                  className="-mt-1 flex size-11 flex-none items-center justify-center text-muted-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ol>
      </Panel>

      <FamilyCard tripId={trip.tripId} initial={trip.familyToken} />

      <Panel className="flex flex-col">
        <div className="flex items-center justify-between pb-2">
          <h2 className={eyebrow}>{t("checkTitle")}</h2>
          <span className="font-semibold">
            {done}/{data.checklist.length}
          </span>
        </div>
        <ul>
          {data.checklist.map((c) => (
            <li key={c.id} className="flex items-center gap-3 border-b border-line">
              <label className="flex min-h-14 flex-1 cursor-pointer items-center gap-4">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={(e) => act({ op: "check.toggle", id: c.id, done: e.target.checked })}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-7 flex-none items-center justify-center rounded-[8px] border-2 peer-focus-visible:ring-3 peer-focus-visible:ring-blue/30",
                    c.done ? "border-ink bg-ink text-white" : "border-input",
                  )}
                >
                  {c.done && <Check className="size-4" />}
                </span>
                <span className="text-[17px]">{label(c.label)}</span>
              </label>
              {!c.label.startsWith("k:") && (
                <button
                  type="button"
                  aria-label={t("remove")}
                  onClick={() => act({ op: "check.remove", id: c.id })}
                  className="flex size-11 items-center justify-center text-muted-foreground"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <form
          className="flex gap-2 pt-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (checkText.trim() && (await act({ op: "check.add", label: checkText.trim() })))
              setCheckText("");
          }}
        >
          <input
            aria-label={t("checkAdd")}
            placeholder={t("checkAdd")}
            value={checkText}
            maxLength={60}
            onChange={(e) => setCheckText(e.target.value)}
            className={clayInput}
          />
          <button type="submit" className={pill}>
            {t("add")}
          </button>
        </form>
        <p className="pt-4 text-[15px] text-muted-foreground">
          {t("groupReady", { n: data.ready, total: data.members.length })}
        </p>
      </Panel>
    </>
  );
}

function PlanForm({
  next,
  hint,
  onSave,
  onCancel,
}: {
  next: number;
  hint: string | null;
  onSave: (v: { day: number; place: string; note?: string }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const t = useTranslations("board");
  const [day, setDay] = useState(String(next));
  const [place, setPlace] = useState("");
  const [note, setNote] = useState("");
  return (
    <InlineForm
      hint={hint}
      onCancel={onCancel}
      disabled={!place.trim() || !(Number(day) >= 1 && Number(day) <= 60)}
      onSave={() => onSave({ day: Number(day), place: place.trim(), note: note.trim() || undefined })}
    >
      <div className="flex gap-2">
        <input
          aria-label={t("dayLabel")}
          inputMode="numeric"
          value={day}
          onChange={(e) => setDay(e.target.value.replace(/\D/g, "").slice(0, 2))}
          className={cn(clayInput, "w-20 flex-none")}
        />
        <input
          aria-label={t("place")}
          placeholder={t("place")}
          value={place}
          maxLength={60}
          onChange={(e) => setPlace(e.target.value)}
          className={clayInput}
        />
      </div>
      <input
        aria-label={t("note")}
        placeholder={t("note")}
        value={note}
        maxLength={200}
        onChange={(e) => setNote(e.target.value)}
        className={clayInput}
      />
    </InlineForm>
  );
}

function InlineForm({
  children,
  hint,
  disabled,
  onSave,
  onCancel,
}: {
  children: ReactNode;
  hint?: string | null;
  disabled: boolean;
  onSave: () => Promise<unknown>;
  onCancel: () => void;
}) {
  const t = useTranslations("board");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-2 rounded-[18px] bg-background p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await onSave();
        setBusy(false);
      }}
    >
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-12 flex-1 rounded-[14px] border border-input bg-card font-medium"
        >
          {t("cancel")}
        </button>
        <button
          type="submit"
          disabled={disabled || busy}
          className="min-h-12 flex-1 rounded-[14px] bg-ink font-semibold text-white disabled:opacity-40"
        >
          {t("save")}
        </button>
      </div>
    </form>
  );
}

/** "Yaqinlarim ham ko'rib tursin": a read-only page for family (App-Family), revocable any time. */
function FamilyCard({ tripId, initial }: { tripId: string; initial: string | null }) {
  const t = useTranslations("board");
  const locale = useLocale();
  const [token, setToken] = useState(initial);
  const call = (op: string) =>
    fetch("/api/safety", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op, tripId }),
    }).catch(() => null);

  async function send() {
    let tok = token;
    if (!tok) {
      const r = await call("family.create");
      if (!r?.ok) return;
      tok = ((await r.json()) as { token: string }).token;
      setToken(tok);
    }
    const url = `${window.location.origin}/${locale}/f/${tok}`;
    openExternal(
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(t("familyShareText"))}`,
    );
  }
  async function revoke() {
    if ((await call("family.revoke"))?.ok) setToken(null);
  }

  return (
    <Panel tone="soft" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-xl font-semibold text-blue-ink">{t("familyTitle")}</span>
          <span className="text-[15px] text-blue-ink/80">{token ? t("familyOn") : t("familyText")}</span>
        </div>
        <button
          type="button"
          onClick={send}
          className="press min-h-12 flex-none rounded-full bg-blue px-6 font-semibold text-white"
        >
          {t("familySend")}
        </button>
      </div>
      {token && (
        <button
          type="button"
          onClick={revoke}
          className="min-h-11 self-start text-sm text-blue-ink underline"
        >
          {t("familyOff")}
        </button>
      )}
    </Panel>
  );
}

// ---------- Yig'amiz ----------

function VoteRow({
  title,
  sub,
  votes,
  max,
  mine,
  onVote,
  onRemove,
}: {
  title: string;
  sub: string;
  votes: number;
  max: number;
  mine: boolean;
  onVote: () => void;
  onRemove?: () => void;
}) {
  const t = useTranslations("board");
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-pressed={mine}
        onClick={onVote}
        className={cn(
          "relative flex min-h-[72px] flex-1 items-center justify-between overflow-hidden rounded-[18px] border-2 px-4 text-left",
          mine ? "border-ink" : "border-line",
        )}
      >
        <span
          className="absolute inset-y-0 left-0 bg-background"
          style={{ width: `${max ? (votes / max) * 100 : 0}%` }}
          aria-hidden="true"
        />
        <span className="relative flex flex-col">
          <span className="text-[17px] font-medium">{title}</span>
          {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
        </span>
        <span className="relative text-lg font-semibold">{votes}</span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={t("remove")}
          onClick={onRemove}
          className="flex size-11 flex-none items-center justify-center text-muted-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

function BookTab({ data, act, me, isOwner, trip, name, money }: TabProps) {
  const t = useTranslations("board");
  const [mode, setMode] = useState<"self" | "tour">("self");
  const [form, setForm] = useState<"flight" | "stay" | null>(null);
  const [deadlineEdit, setDeadlineEdit] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);
  const flights = data.options.flight;
  const stays = data.options.stay;
  const offers = [...data.options.offer].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const bought = data.tickets.includes(me);
  const booked = stays.find((s) => s.bookedBy);
  const daysLeft = trip.deadline
    ? Math.round((Date.parse(trip.deadline) - Date.parse(trip.today)) / 86_400_000)
    : null;
  const maxVotes = (list: { votes: number }[]) => Math.max(1, ...list.map((o) => o.votes));

  return (
    <>
      <div
        role="radiogroup"
        aria-label={t("tab")}
        className="grid grid-cols-2 gap-1 rounded-full bg-card p-1"
      >
        {(["self", "tour"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={mode === k}
            onClick={() => setMode(k)}
            className={cn(
              "min-h-12 rounded-full text-[15px]",
              mode === k ? "bg-ink font-semibold text-white" : "text-muted-foreground",
            )}
          >
            {t(`${k}Mode`)}
          </button>
        ))}
      </div>

      {mode === "self" && (
        <>
          <Panel className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className={eyebrow}>{t("flightHead", { to: trip.destination })}</h2>
              <span className="text-sm text-muted-foreground">{trip.startLabel}</span>
            </div>
            <p className="text-lg font-semibold">{t("flightTitle")}</p>
            {flights.length === 0 && form !== "flight" && (
              <p className="text-muted-foreground">{t("flightEmpty")}</p>
            )}
            {flights.map((o) => (
              <VoteRow
                key={o.id}
                title={o.title}
                sub={[o.detail, o.price != null && `~${money(o.price)}`].filter(Boolean).join(" · ")}
                votes={o.votes}
                max={maxVotes(flights)}
                mine={data.myVotes.flight === o.id}
                onVote={() => act({ op: "option.vote", id: o.id })}
                onRemove={o.canRemove || isOwner ? () => act({ op: "option.remove", id: o.id }) : undefined}
              />
            ))}
            {form === "flight" ? (
              <OptionForm
                kind="flight"
                onCancel={() => setForm(null)}
                onSave={async (v) => (await act({ op: "option.add", ...v })) && setForm(null)}
              />
            ) : (
              <button type="button" onClick={() => setForm("flight")} className={cn(pill, "self-start")}>
                {t("addOption")}
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {data.members.map((m) => (
                  <span
                    key={m.id}
                    title={m.name}
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full border-2 border-card text-sm font-semibold",
                      toneOf(m.id),
                      !data.tickets.includes(m.id) && "opacity-35",
                    )}
                  >
                    {m.name.slice(0, 1)}
                  </span>
                ))}
              </div>
              <span className="text-[15px] text-muted-foreground">
                {t("ticketsBought", { n: data.tickets.length, total: data.members.length })}
              </span>
            </div>
            <button
              type="button"
              aria-pressed={bought}
              onClick={() => act({ op: "ticket.set", bought: !bought })}
              className={cn(
                "flex min-h-12 items-center justify-center gap-2 rounded-full border-2 font-semibold",
                bought ? "border-success bg-success-soft text-success" : "border-input",
              )}
            >
              {bought && <Check className="size-5" aria-hidden="true" />}
              {bought ? t("bought") : t("markBought")}
            </button>
            {trip.flightUrl && (
              <ExternalLink
                href={trip.flightUrl}
                className="press flex min-h-14 items-center justify-center gap-2 rounded-full bg-ink text-lg font-semibold text-white"
              >
                {t("searchFlight")}
                <ArrowUpRight className="size-5" aria-hidden="true" />
              </ExternalLink>
            )}
            {trip.deadline && !deadlineEdit && (
              <div className="flex items-center justify-between gap-2 rounded-[14px] bg-[#fff8e1] px-4 py-3 text-[15px]">
                <span>{t.rich("deadline", { date: trip.deadlineLabel ?? "", b: (c) => <b>{c}</b> })}</span>
                <span className="font-semibold text-[#b45309]">
                  {daysLeft! >= 0 ? t("daysLeft", { n: daysLeft! }) : t("deadlinePassed")}
                </span>
              </div>
            )}
            {isOwner &&
              (deadlineEdit ? (
                <DeadlineForm
                  value={trip.deadline}
                  max={trip.startDate}
                  onCancel={() => setDeadlineEdit(false)}
                  onSave={async (day) => (await act({ op: "deadline.set", day })) && setDeadlineEdit(false)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setDeadlineEdit(true)}
                  className={cn(linkBtn, "self-start text-sm")}
                >
                  {trip.deadline ? t("changeDeadline") : t("setDeadline")}
                </button>
              ))}
            <p className="text-center text-sm text-muted-foreground">
              {trip.deadline && `${t("deadlineRule")} `}
              {t("flightNote")}
            </p>
          </Panel>

          <Panel className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className={eyebrow}>{t("stayHead", { place: trip.destination })}</h2>
              {booked && <span className="text-sm font-semibold text-success">{t("chosen")}</span>}
            </div>
            {stays.length === 0 && form !== "stay" && (
              <p className="text-muted-foreground">{t("stayEmpty")}</p>
            )}
            {booked ? (
              <>
                <div className="flex items-center gap-4">
                  <Image
                    src={trip.photo}
                    alt=""
                    width={96}
                    height={96}
                    className="size-24 rounded-[18px] object-cover"
                  />
                  <div className="flex flex-col">
                    <span className="text-lg font-semibold">{booked.title}</span>
                    <span className="text-[15px] text-muted-foreground">
                      {[
                        booked.price != null && t("perNight", { price: money(booked.price) }),
                        t("votes", { n: booked.votes }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </div>
                </div>
                <p className="rounded-[14px] bg-background px-4 py-3 text-[15px]">
                  {booked.bookedBy === me
                    ? t("bookedByMe", { n: data.members.length })
                    : t("bookedBy", { name: name(booked.bookedBy!), n: data.members.length })}
                </p>
              </>
            ) : (
              stays.map((o) => (
                <div key={o.id} className="flex flex-col gap-2">
                  <VoteRow
                    title={o.title}
                    sub={[
                      o.nights && t("nightsN", { n: o.nights }),
                      o.price != null && t("perNight", { price: money(o.price) }),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    votes={o.votes}
                    max={maxVotes(stays)}
                    mine={data.myVotes.stay === o.id}
                    onVote={() => act({ op: "option.vote", id: o.id })}
                    onRemove={
                      o.canRemove || isOwner ? () => act({ op: "option.remove", id: o.id }) : undefined
                    }
                  />
                  <div className="flex gap-4 px-1">
                    {o.url && (
                      <ExternalLink href={o.url} className={cn(linkBtn, "text-sm")}>
                        {t("open")}
                      </ExternalLink>
                    )}
                    <button
                      type="button"
                      onClick={() => setBooking(booking === o.id ? null : o.id)}
                      className={cn(linkBtn, "text-sm text-blue")}
                    >
                      {t("iBook")}
                    </button>
                  </div>
                  {booking === o.id && (
                    <AmountForm
                      label={t("bookAmount")}
                      initial={o.price != null && o.nights ? (o.price * o.nights) / 100 : undefined}
                      hint={t("bookHint", { n: data.members.length })}
                      onCancel={() => setBooking(null)}
                      onSave={async (amount) =>
                        (await act({ op: "stay.book", id: o.id, amount })) && setBooking(null)
                      }
                    />
                  )}
                </div>
              ))
            )}
            {!booked &&
              (form === "stay" ? (
                <OptionForm
                  kind="stay"
                  onCancel={() => setForm(null)}
                  onSave={async (v) => (await act({ op: "option.add", ...v })) && setForm(null)}
                />
              ) : (
                <button type="button" onClick={() => setForm("stay")} className={cn(pill, "self-start")}>
                  {t("addOption")}
                </button>
              ))}
          </Panel>
        </>
      )}

      <Panel tone="dark" className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold tracking-[.06em] text-[#c9c9c9] uppercase">
            {t("tourEyebrow")}
          </h2>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-sm font-medium">{t("partner")}</span>
        </div>
        <Display as="div" className="text-[34px] leading-[1.02]">
          {t("tourTitle")}
        </Display>
        <p className="text-[#c9c9c9]">{t("tourText")}</p>
        {offers.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={data.myVotes.offer === o.id}
            onClick={() => act({ op: "option.vote", id: o.id })}
            className={cn(
              "flex min-h-[72px] items-center gap-3 rounded-[18px] bg-white/8 px-3 py-3 text-left",
              data.myVotes.offer === o.id && "ring-2 ring-signal",
            )}
          >
            <span className="flex size-12 flex-none items-center justify-center rounded-xl bg-white/10 font-semibold">
              {o.title.slice(0, 1)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">{o.title}</span>
              <span className="text-sm text-[#c9c9c9]">
                {[o.detail, t("votes", { n: o.votes })].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="font-display text-[28px]">{money(o.price)}</span>
          </button>
        ))}
        {data.agencyRequested ? (
          <p className="rounded-[14px] bg-white/10 px-4 py-3 text-[15px]">{t("asked")}</p>
        ) : (
          <button
            type="button"
            onClick={() => act({ op: "agency.request" })}
            className="press min-h-14 rounded-full bg-signal text-lg font-semibold text-ink"
          >
            {t("askPrice")}
          </button>
        )}
        {trip.price && (
          <Link
            href={`/price/${trip.price.country}?days=${trip.price.days}`}
            className="min-h-11 text-center text-[15px] text-signal underline underline-offset-4"
          >
            {t("realPrice", { price: money(trip.price.median) })} {"↗"}
          </Link>
        )}
        <p className="text-center text-sm text-[#9a9a9a]">{t("tourNote")}</p>
      </Panel>
    </>
  );
}

function OptionForm({
  kind,
  onSave,
  onCancel,
}: {
  kind: "flight" | "stay";
  onSave: (v: {
    kind: "flight" | "stay";
    title: string;
    detail?: string;
    price?: number;
    nights?: number;
    url?: string;
  }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const t = useTranslations("board");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [price, setPrice] = useState("");
  const [nights, setNights] = useState("");
  const [url, setUrl] = useState("");
  const urlOk = !url.trim() || /^https:\/\/\S+$/.test(url.trim());
  return (
    <InlineForm
      onCancel={onCancel}
      disabled={!title.trim() || !urlOk}
      onSave={() =>
        onSave({
          kind,
          title: title.trim(),
          detail: kind === "flight" ? detail.trim() || undefined : undefined,
          price: Number(price) > 0 ? Number(price) : undefined,
          nights: kind === "stay" && Number(nights) > 0 ? Number(nights) : undefined,
          url: kind === "stay" && url.trim() ? url.trim() : undefined,
        })
      }
    >
      <input
        aria-label={t(kind === "flight" ? "flightTime" : "stayName")}
        placeholder={t(kind === "flight" ? "flightTime" : "stayName")}
        value={title}
        maxLength={80}
        onChange={(e) => setTitle(e.target.value)}
        className={clayInput}
      />
      {kind === "flight" ? (
        <input
          aria-label={t("flightDetail")}
          placeholder={t("flightDetail")}
          value={detail}
          maxLength={80}
          onChange={(e) => setDetail(e.target.value)}
          className={clayInput}
        />
      ) : (
        <input
          aria-label={t("nights")}
          placeholder={t("nights")}
          inputMode="numeric"
          value={nights}
          onChange={(e) => setNights(e.target.value.replace(/\D/g, "").slice(0, 2))}
          className={clayInput}
        />
      )}
      <input
        aria-label={t(kind === "flight" ? "priceFlight" : "priceNight")}
        placeholder={t(kind === "flight" ? "priceFlight" : "priceNight")}
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
        className={clayInput}
      />
      {kind === "stay" && (
        <input
          aria-label={t("link")}
          aria-invalid={!urlOk}
          placeholder={t("link")}
          type="url"
          value={url}
          maxLength={500}
          onChange={(e) => setUrl(e.target.value)}
          className={clayInput}
        />
      )}
    </InlineForm>
  );
}

function AmountForm({
  label,
  initial,
  hint,
  onSave,
  onCancel,
}: {
  label: string;
  initial?: number;
  hint?: string;
  onSave: (amount: number) => Promise<unknown>;
  onCancel: () => void;
}) {
  const [v, setV] = useState(initial ? String(initial) : "");
  return (
    <InlineForm hint={hint} onCancel={onCancel} disabled={!(Number(v) > 0)} onSave={() => onSave(Number(v))}>
      <input
        aria-label={label}
        placeholder={label}
        inputMode="decimal"
        value={v}
        onChange={(e) => setV(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
        className={clayInput}
      />
    </InlineForm>
  );
}

function DeadlineForm({
  value,
  max,
  onSave,
  onCancel,
}: {
  value: string | null;
  max: string;
  onSave: (day: string | null) => Promise<unknown>;
  onCancel: () => void;
}) {
  const t = useTranslations("board");
  const [v, setV] = useState(value ?? "");
  return (
    <InlineForm onCancel={onCancel} disabled={false} onSave={() => onSave(v || null)}>
      <input
        aria-label={t("setDeadline")}
        type="date"
        value={v}
        max={max}
        onChange={(e) => setV(e.target.value)}
        className={clayInput}
      />
    </InlineForm>
  );
}

// ---------- Xarajat ----------

const CATS = ["stay", "transport", "food", "other"] as const;

function CostsTab({ data, act, me, name, money }: TabProps) {
  const t = useTranslations("board");
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null); // a payment can't be undone: tap twice
  const iOwe = data.debts.filter((d) => d.from === me);
  const owedToMe = data.debts.filter((d) => d.to === me).reduce((s, d) => s + d.amount, 0);
  const myDebt = iOwe.reduce((s, d) => s + d.amount, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Panel className="flex flex-col gap-3">
          <h2 className={eyebrow}>{t("total")}</h2>
          <Display as="div" className="text-[44px] leading-none">
            {money(data.total)}
          </Display>
          <p className="text-sm text-muted-foreground">
            {t("totalMeta", { people: data.members.length, n: data.expenses.length })}
          </p>
        </Panel>
        <Panel tone="dark" className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-[.06em] text-[#c9c9c9] uppercase">
            {myDebt ? t("youPay") : owedToMe ? t("youGet") : t("youPay")}
          </h2>
          <Display as="div" className="text-[44px] leading-none text-signal">
            {money(myDebt || owedToMe)}
          </Display>
          <p className="text-sm text-[#c9c9c9]">
            {myDebt ? iOwe.map((d) => name(d.to)).join(", ") : owedToMe ? t("fromGroup") : t("even")}
          </p>
        </Panel>
      </div>

      {adding && (
        <Panel>
          <ExpenseForm
            members={data.members}
            me={me}
            onCancel={() => setAdding(false)}
            onSave={async (v) => (await act({ op: "expense.add", ...v })) && setAdding(false)}
          />
        </Panel>
      )}

      <Panel className="flex flex-col">
        <h2 className={cn(eyebrow, "pb-2")}>{t("whoOwes")}</h2>
        {data.debts.length === 0 && <p className="py-2 text-muted-foreground">{t("settled")}</p>}
        {data.debts.map((d) => (
          <div
            key={`${d.from}-${d.to}`}
            className="flex min-h-14 items-center justify-between gap-2 border-b border-line last:border-0"
          >
            <span className="text-[17px]">
              {name(d.from)} <span className="text-muted-foreground">→</span> {name(d.to)}
            </span>
            <span className="flex items-center gap-3">
              <b className="text-[17px]">{money(d.amount)}</b>
              {d.from === me && (
                <button
                  type="button"
                  onClick={async () => {
                    if (confirming !== d.to) return setConfirming(d.to);
                    setConfirming(null);
                    await act({ op: "settle", to: d.to, amount: d.amount / 100 });
                  }}
                  className={cn(pill, confirming === d.to && "border-ink bg-ink text-white")}
                >
                  {confirming === d.to ? t("paidConfirm") : t("paid")}
                </button>
              )}
            </span>
          </div>
        ))}
      </Panel>

      <Panel className="flex flex-col">
        <h2 className={cn(eyebrow, "pb-2")}>{t("expensesTitle")}</h2>
        {data.expenses.length === 0 && <p className="py-2 text-muted-foreground">{t("expEmpty")}</p>}
        {data.expenses.map((e) => (
          <div key={e.id} className="flex min-h-[72px] items-center gap-3 border-b border-line last:border-0">
            <span className="flex h-12 w-16 flex-none items-center justify-center rounded-[14px] bg-background text-sm font-semibold">
              {t(`cat_${e.category as (typeof CATS)[number]}`)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[17px]">{e.title}</span>
              <span className="text-sm text-muted-foreground">
                {e.paidBy === me ? t("paidByMe") : t("paidBy", { name: name(e.paidBy) })} ·{" "}
                {t("splitN", { n: e.split })}
              </span>
            </span>
            <b className="text-lg">{money(e.amount)}</b>
            {e.canRemove && (
              <button
                type="button"
                aria-label={t("remove")}
                onClick={() => act({ op: "expense.remove", id: e.id })}
                className="flex size-11 items-center justify-center text-muted-foreground"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </Panel>

      <Panel tone="soft" className="text-[15px]">
        {t("costsNote")}
      </Panel>
      <div className="h-20" />
      {!adding && <MainAction label={t("addExpense")} onClick={() => setAdding(true)} />}
    </>
  );
}

function ExpenseForm({
  members,
  me,
  onSave,
  onCancel,
}: {
  members: { id: string; name: string }[];
  me: string;
  onSave: (v: {
    title: string;
    category: (typeof CATS)[number];
    amount: number;
    paidBy: string;
  }) => Promise<unknown>;
  onCancel: () => void;
}) {
  const t = useTranslations("board");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<(typeof CATS)[number]>("food");
  const [paidBy, setPaidBy] = useState(me);
  return (
    <InlineForm
      hint={t("splitHint", { n: members.length })}
      onCancel={onCancel}
      disabled={!title.trim() || !(Number(amount) > 0)}
      onSave={() => onSave({ title: title.trim(), category, amount: Number(amount), paidBy })}
    >
      <Display as="h2" className="text-2xl">
        {t("addExpense")}
      </Display>
      <input
        aria-label={t("expTitle")}
        placeholder={t("expTitle")}
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
        className={clayInput}
      />
      <input
        aria-label={t("amount")}
        placeholder={t("amount")}
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
        className={clayInput}
      />
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("category")}>
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => setCategory(c)}
            className={cn(pill, category === c && "border-ink bg-ink text-white")}
          >
            {t(`cat_${c}`)}
          </button>
        ))}
      </div>
      <label className="text-[13px] font-semibold" htmlFor="paid-by">
        {t("whoPaid")}
      </label>
      <select id="paid-by" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} className={clayInput}>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.id === me ? t("you") : m.name}
          </option>
        ))}
      </select>
    </InlineForm>
  );
}
