"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Panel, clayInput } from "@/components/clay";
import { BackAction } from "@/components/telegram-actions";
import { useRouter } from "@/i18n/navigation";
import type { Emergency } from "@/lib/emergency";
import { haptic, openExternal } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

type Contact = { id: string; name: string; token: string; linked: boolean };
type Props = {
  tripId: string;
  title: string;
  country: string;
  emergency: Emergency | null;
  organizer: string | null;
  bot: string;
  contacts: Contact[];
  lastCheckin: string | null;
  sharingUntil: string | null;
  groupSize: number;
};

const HOLD_MS = 3000;
const post = (body: unknown) =>
  fetch("/api/safety", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);

/** Best effort: a few seconds for a position, otherwise send without one. */
const position = (timeout = 4000) =>
  new Promise<{ lat: number; lng: number } | null>((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 60_000 },
    );
  });

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const row = "flex min-h-16 items-center gap-3 border-b border-line last:border-0";
const avatar = "flex size-11 flex-none items-center justify-center rounded-full text-sm font-semibold";

export function Sos(p: Props) {
  const t = useTranslations("sos");
  const router = useRouter();
  const [holding, setHolding] = useState(false);
  const [sent, setSent] = useState<"sending" | "sent" | "failed" | null>(null);
  const [checkin, setCheckin] = useState(p.lastCheckin);
  const [contacts, setContacts] = useState(p.contacts);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [sharing, setSharing] = useState(!!p.sharingUntil); // server returns only an active share;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function start() {
    if (sent === "sending") return;
    setHolding(true);
    haptic.select();
    timer.current = setTimeout(fire, HOLD_MS);
  }
  function cancel() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }
  async function fire() {
    timer.current = null;
    setHolding(false);
    setSent("sending");
    haptic.error(); // strongest vibration Telegram offers
    const at = await position();
    const r = await post({ op: "sos", tripId: p.tripId, ...at });
    setSent(r?.ok ? "sent" : "failed");
  }

  async function markOk() {
    const r = await post({ op: "checkin", tripId: p.tripId });
    if (r?.ok) {
      haptic.success();
      setCheckin(new Date().toISOString());
    }
  }

  // 1-hour location share: updates while this page is open, at most once a minute.
  useEffect(() => {
    if (!sharing || !navigator.geolocation) return;
    let last = 0;
    const until = Date.now() + 3600_000;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        if (Date.now() > until) return setSharing(false);
        if (Date.now() - last < 60_000) return;
        last = Date.now();
        void post({ op: "location", tripId: p.tripId, lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setSharing(false),
      { enableHighAccuracy: true },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [sharing, p.tripId]);

  function toggleShare() {
    if (sharing) void post({ op: "location_off", tripId: p.tripId });
    setSharing(!sharing);
  }

  async function addContact() {
    const r = await post({ op: "contact.add", name: name.trim() });
    if (!r?.ok) return;
    const { id, token } = (await r.json()) as { id: string; token: string };
    setContacts([...contacts, { id, name: name.trim(), token, linked: false }]);
    setName("");
    setAdding(false);
    invite(token);
  }
  function invite(token: string) {
    if (!p.bot) return;
    const link = `https://t.me/${p.bot}?start=trust_${token}`;
    openExternal(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(t("inviteText"))}`,
    );
  }
  async function removeContact(c: Contact) {
    setContacts(contacts.filter((x) => x !== c));
    await post({ op: "contact.remove", id: c.id });
  }

  const others = Math.max(0, p.groupSize - 1 - (p.organizer ? 1 : 0));
  const e = p.emergency;

  return (
    <>
      <BackAction label={t("back")} onClick={() => router.push(`/trips/${p.tripId}/room`)} />
      <div className="text-center">
        <h1 className="font-semibold">{t("title")}</h1>
        <div className="text-xs text-muted-foreground">{p.title}</div>
      </div>

      <Panel className="flex flex-col items-center gap-4 py-6">
        <button
          type="button"
          aria-label={t("holdLabel")}
          onPointerDown={start}
          onPointerUp={cancel}
          onPointerLeave={cancel}
          onPointerCancel={cancel}
          onKeyDown={(ev) => (ev.key === " " || ev.key === "Enter") && !ev.repeat && start()}
          onKeyUp={cancel}
          onContextMenu={(ev) => ev.preventDefault()}
          className="relative flex size-60 touch-none items-center justify-center rounded-full bg-[#fdf2f2] select-none"
        >
          <span className="absolute inset-4 rounded-full bg-[#fbe4e4]" aria-hidden="true" />
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 rounded-full border-[6px] border-danger opacity-0",
              holding && "animate-[sos-fill_3s_linear_forwards]",
            )}
          />
          <span className="relative flex size-44 items-center justify-center rounded-full bg-danger font-display text-6xl font-semibold text-white">
            SOS
          </span>
        </button>
        <p className="max-w-[320px] text-center text-[16px]" role="status">
          {sent === "sending"
            ? t("sending")
            : sent === "sent"
              ? t("sent")
              : sent === "failed"
                ? t("failed")
                : holding
                  ? t("keepHolding")
                  : t("hold")}
        </p>
      </Panel>

      <button
        type="button"
        onClick={markOk}
        className="press flex min-h-14 items-center justify-center gap-2 rounded-full bg-success text-lg font-semibold text-white"
      >
        <Check className="size-5" aria-hidden="true" />
        {checkin ? t("okAgain", { time: time(checkin) }) : t("ok")}
      </button>

      <Panel className="flex flex-col">
        <h2 className="pb-1 text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase">
          {t("who")}
        </h2>
        {contacts.map((c) => (
          <div key={c.token} className={row}>
            <span className={cn(avatar, "bg-[#e8dccb]")}>{c.name.slice(0, 1)}</span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[17px]">{c.name}</span>
              <span className="text-sm text-muted-foreground">{t("trusted")}</span>
            </span>
            {c.linked ? (
              <span className="flex items-center gap-1 text-sm text-success">
                Telegram <Check className="size-4" aria-hidden="true" />
              </span>
            ) : (
              <button
                type="button"
                onClick={() => invite(c.token)}
                className="min-h-11 text-sm text-blue underline"
              >
                {t("sendInvite")}
              </button>
            )}
            <button
              type="button"
              aria-label={t("remove", { name: c.name })}
              onClick={() => removeContact(c)}
              className="flex size-11 items-center justify-center text-muted-foreground"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
        {p.organizer && (
          <div className={row}>
            <span className={cn(avatar, "bg-[#cfdae6]")}>{p.organizer.slice(0, 1)}</span>
            <span className="flex-1 text-[17px]">
              {p.organizer} · {t("organizer")}
            </span>
            <span className="flex items-center gap-1 text-sm text-success">
              {t("app")} <Check className="size-4" aria-hidden="true" />
            </span>
          </div>
        )}
        {others > 0 && (
          <div className={row}>
            <span className={cn(avatar, "bg-background")}>{others}</span>
            <span className="flex-1 text-[17px]">{t("rest")}</span>
            <span className="flex items-center gap-1 text-sm text-success">
              {t("app")} <Check className="size-4" aria-hidden="true" />
            </span>
          </div>
        )}
        {adding ? (
          <form
            className="flex gap-2 pt-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (name.trim()) void addContact();
            }}
          >
            <input
              aria-label={t("contactName")}
              placeholder={t("contactName")}
              value={name}
              maxLength={40}
              autoFocus
              onChange={(ev) => setName(ev.target.value)}
              className={clayInput}
            />
            <button
              type="submit"
              disabled={!name.trim()}
              className="min-h-12 rounded-full bg-ink px-5 font-semibold text-white disabled:opacity-40"
            >
              {t("invite")}
            </button>
          </form>
        ) : (
          contacts.length < 5 && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="min-h-12 self-start pt-2 text-[15px] font-medium text-blue"
            >
              {t("addContact")}
            </button>
          )
        )}
        {contacts.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground">{t("contactHint")}</p>
        )}
      </Panel>

      <Panel className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span id="share-loc" className="text-[17px]">
            {t("share")}
          </span>
          <span className="text-sm text-muted-foreground">{t("shareHint")}</span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={sharing}
          aria-labelledby="share-loc"
          onClick={toggleShare}
          className="flex min-h-11 flex-none items-center"
        >
          <span
            className={cn(
              "flex h-7 w-12 items-center rounded-full p-0.5 transition-colors",
              sharing ? "bg-success" : "bg-line",
            )}
          >
            <span
              className={cn(
                "size-6 rounded-full bg-white shadow transition-transform",
                sharing && "translate-x-5",
              )}
            />
          </span>
        </button>
      </Panel>

      {e && (
        <Panel tone="dark" className="flex flex-col">
          <h2 className="pb-1 text-xs font-semibold tracking-[.06em] text-[#c9c9c9] uppercase">
            {t("inCountry", { country: p.country })}
          </h2>
          {("all" in e
            ? [["all", e.all]]
            : [
                ["police", e.police],
                ["ambulance", e.ambulance],
              ]
          ).map(([k, n]) => (
            <a
              key={k}
              href={`tel:${n}`}
              className="flex min-h-16 items-center justify-between gap-3 border-b border-white/15 last:border-0"
            >
              <span className="text-[17px]">{t(`num_${k}` as "num_all")}</span>
              <span className="font-display text-[44px] leading-none text-signal">{n}</span>
            </a>
          ))}
          {"all" in e && e.all === "112" && <p className="pt-2 text-sm text-[#c9c9c9]">{t("noSim")}</p>}
        </Panel>
      )}
      <div className="h-6" />
    </>
  );
}
