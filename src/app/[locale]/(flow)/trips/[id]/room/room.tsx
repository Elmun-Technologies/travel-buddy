"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Display, Panel } from "@/components/clay";
import { ReportLink } from "@/components/report-link";
import { BackAction } from "@/components/telegram-actions";
import { InviteButton, type ShareLinks } from "@/components/trips/share";
import { Link, useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";
import type { ChatMessage, PollView } from "@/modules/chat/service";
import { Board, type BoardTrip, toneOf } from "./board";

type Msg = ChatMessage & { poll?: PollView };
type Tab = "chat" | "plan" | "book" | "costs";

const post = (url: string, body: unknown, method = "POST") =>
  fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(
    () => null,
  );

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** App-Room-Chat: tabs, invite bar, pinned announcement, live chat with polls, composer. */
export function Room({
  tripId,
  title,
  me,
  organizerId,
  isOwner,
  pinned: pinnedInitial,
  initial,
  polls: pollsInitial,
  spots,
  share,
  board,
}: {
  tripId: string;
  title: string;
  me: string;
  organizerId: string | null;
  isOwner: boolean;
  pinned: string | null;
  initial: ChatMessage[];
  polls: Record<string, PollView>;
  spots: { n: number; max: number } | null;
  share: ShareLinks | null;
  board: BoardTrip;
}) {
  const t = useTranslations("room");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("chat");
  const [msgs, setMsgs] = useState<Msg[]>(initial);
  const [polls, setPolls] = useState(pollsInitial);
  const [pinned, setPinned] = useState(pinnedInitial);
  const [hidden, setHidden] = useState<string[]>([]); // people blocked during this visit
  const [text, setText] = useState("");
  const [menu, setMenu] = useState(false);
  const [sheet, setSheet] = useState<"poll" | "pin" | null>(null);
  const [focus, setFocus] = useState<string | null>(null); // message whose author menu is open
  const [error, setError] = useState<string | null>(null);
  const [boardVersion, setBoardVersion] = useState(0); // bumped by live "board" events: tabs refetch
  const bottom = useRef<HTMLDivElement>(null);

  // Live updates (SSE). EventSource reconnects by itself after network drops.
  useEffect(() => {
    const es = new EventSource(`/api/rooms/${tripId}/stream`);
    es.addEventListener("message", (e) => {
      const m = JSON.parse((e as MessageEvent).data) as Msg;
      if (m.poll) setPolls((p) => ({ ...p, [m.poll!.id]: m.poll! }));
      setMsgs((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
    });
    es.addEventListener("poll", (e) => {
      const p = JSON.parse((e as MessageEvent).data) as PollView | null;
      if (p) setPolls((all) => ({ ...all, [p.id]: { ...p, mine: all[p.id]?.mine ?? p.mine } }));
    });
    es.addEventListener("pin", (e) =>
      setPinned((JSON.parse((e as MessageEvent).data) as { text: string | null }).text),
    );
    es.addEventListener("board", () => setBoardVersion((v) => v + 1));
    return () => es.close();
  }, [tripId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    const res = await post(`/api/rooms/${tripId}/messages`, { body });
    if (!res?.ok) {
      setText(body);
      setError(res?.status === 429 ? t("slowDown") : t("sendFailed"));
      return;
    }
    setError(null);
    const { id } = (await res.json()) as { id: string };
    // Shown at once; the live event with the same id is then ignored.
    setMsgs((list) =>
      list.some((x) => x.id === id)
        ? list
        : [
            ...list,
            { id, senderId: me, name: "", body, kind: "text", pollId: null, at: new Date().toISOString() },
          ],
    );
  }

  async function voteFor(pollId: string, optionId: string) {
    haptic.select();
    setPolls((all) => {
      const p = all[pollId];
      if (!p) return all;
      const options = p.options.map((o) => ({
        ...o,
        votes: o.votes + (o.id === optionId ? 1 : 0) - (o.id === p.mine ? 1 : 0),
      }));
      return { ...all, [pollId]: { ...p, options, mine: optionId, voters: p.voters + (p.mine ? 0 : 1) } };
    });
    await post(`/api/rooms/${tripId}/polls/${pollId}/vote`, { optionId });
  }

  async function blockUser(userId: string) {
    await post("/api/blocks", { userId });
    setHidden((h) => [...h, userId]);
    setFocus(null);
  }

  const visible = msgs.filter((m) => !m.senderId || !hidden.includes(m.senderId));

  return (
    <>
      <BackAction label={t("back")} onClick={() => router.push(`/trips/${tripId}`)} />
      <div className="relative text-center">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{t("subtitle")}</div>
        <Link
          href={`/trips/${tripId}/sos`}
          aria-label={t("sosLabel")}
          className="absolute top-0 right-0 flex min-h-11 items-center rounded-full bg-danger px-4 text-sm font-bold text-white"
        >
          SOS
        </Link>
      </div>

      <div role="tablist" className="grid grid-cols-4 gap-1 rounded-full bg-card p-1">
        {(["chat", "plan", "book", "costs"] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              "min-h-11 rounded-full text-[15px]",
              tab === k ? "bg-ink font-semibold text-white" : "text-muted-foreground",
            )}
          >
            {t(`tab_${k}`)}
          </button>
        ))}
      </div>

      {tab !== "chat" ? (
        <Board tab={tab} tripId={tripId} me={me} isOwner={isOwner} version={boardVersion} trip={board} />
      ) : (
        <>
          {spots && spots.n < spots.max && share && (
            <Panel className="flex items-center justify-between gap-3 py-3">
              <p className="text-[15px]">
                <b>
                  {spots.n}/{spots.max}
                </b>{" "}
                · {t("invite", { n: spots.max - spots.n })}
              </p>
              <InviteButton label={t("inviteCta")} {...share} />
            </Panel>
          )}

          {pinned && (
            <div className="flex items-center gap-3 rounded-[18px] bg-ink px-4 py-3 text-white">
              <span className="flex-none rounded-full bg-signal px-2.5 py-1 text-xs font-bold text-ink">
                {t("pin")}
              </span>
              <span className="flex-1 text-[15px]">{pinned}</span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setSheet("pin")}
                  className="min-h-11 text-xs text-[#c9c9c9] underline"
                >
                  {t("edit")}
                </button>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 pb-24" aria-live="polite">
            {visible.length === 0 && <p className="py-10 text-center text-muted-foreground">{t("empty")}</p>}
            {visible.map((m) => {
              const mine = m.senderId === me;
              const poll = m.pollId ? polls[m.pollId] : undefined;
              if (poll)
                return (
                  <Panel key={m.id} className="flex flex-col gap-3">
                    <div className="flex justify-between text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase">
                      <span>{t("poll")}</span>
                      <span>{t("votes", { n: poll.voters })}</span>
                    </div>
                    <div className="text-lg font-semibold">{poll.question}</div>
                    {poll.options.map((o) => {
                      const pct = poll.voters ? Math.round((o.votes / poll.voters) * 100) : 0;
                      return (
                        <button
                          key={o.id}
                          type="button"
                          aria-pressed={poll.mine === o.id}
                          onClick={() => voteFor(poll.id, o.id)}
                          className={cn(
                            "relative flex min-h-12 items-center justify-between overflow-hidden rounded-[14px] border px-4 text-left",
                            poll.mine === o.id ? "border-ink" : "border-line",
                          )}
                        >
                          <span
                            className="absolute inset-y-0 left-0 bg-background"
                            style={{ width: `${pct}%` }}
                            aria-hidden="true"
                          />
                          <span className="relative">{o.label}</span>
                          <span className="relative font-semibold">{o.votes}</span>
                        </button>
                      );
                    })}
                  </Panel>
                );
              return (
                <div key={m.id} className={cn("flex items-end gap-2", mine && "justify-end")}>
                  {!mine && (
                    <span
                      className={cn(
                        "flex size-9 flex-none items-center justify-center rounded-full text-sm font-semibold",
                        toneOf(m.senderId),
                      )}
                    >
                      {m.name.slice(0, 1)}
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-[18px] px-3.5 py-2.5",
                      mine ? "bg-blue text-white" : "bg-card",
                    )}
                  >
                    {!mine && (
                      <button
                        type="button"
                        onClick={() => setFocus(focus === m.id ? null : m.id)}
                        className="block text-left text-[13px] font-semibold text-blue"
                      >
                        {m.name}
                        {m.senderId === organizerId && ` · ${t("organizer")}`}
                      </button>
                    )}
                    <p className="text-[16px] whitespace-pre-wrap">{m.body}</p>
                    <div
                      className={cn(
                        "text-right text-[11px]",
                        mine ? "text-white/70" : "text-muted-foreground",
                      )}
                    >
                      {time(m.at)}
                    </div>
                    {focus === m.id && m.senderId && (
                      <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
                        <ReportLink targetType="message" targetId={m.id} />
                        <button
                          type="button"
                          onClick={() => blockUser(m.senderId!)}
                          className="min-h-11 self-start text-sm text-danger"
                        >
                          {t("block", { name: m.name })}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottom} />
          </div>

          {sheet && <Sheet kind={sheet} tripId={tripId} pinned={pinned} onClose={() => setSheet(null)} />}

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {error && <p className="px-4 pt-2 text-sm text-danger">{error}</p>}
            {menu && (
              <div className="mx-auto flex max-w-[480px] gap-2 px-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setSheet("poll");
                    setMenu(false);
                  }}
                  className="min-h-11 rounded-full border border-input px-4 text-sm font-medium"
                >
                  {t("newPoll")}
                </button>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setSheet("pin");
                      setMenu(false);
                    }}
                    className="min-h-11 rounded-full border border-input px-4 text-sm font-medium"
                  >
                    {t("newPin")}
                  </button>
                )}
              </div>
            )}
            <form
              className="mx-auto flex max-w-[480px] items-center gap-2 px-3 pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <button
                type="button"
                aria-label={t("more")}
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
                className="flex size-12 flex-none items-center justify-center rounded-full border border-input"
              >
                <Plus className="size-5" aria-hidden="true" />
              </button>
              <label htmlFor="room-input" className="sr-only">
                {t("placeholder")}
              </label>
              <input
                id="room-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={2000}
                autoComplete="off"
                placeholder={t("placeholder")}
                className="min-h-12 flex-1 rounded-full bg-background px-5 text-base outline-none"
              />
              <button
                type="submit"
                aria-label={t("send")}
                className="flex size-12 flex-none items-center justify-center rounded-full bg-ink text-white"
              >
                <ArrowRight className="size-5" aria-hidden="true" />
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}

/** New poll / pinned announcement. */
function Sheet({
  kind,
  tripId,
  pinned,
  onClose,
}: {
  kind: "poll" | "pin";
  tripId: string;
  pinned: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("room");
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [pin, setPin] = useState(pinned ?? "");
  const [busy, setBusy] = useState(false);
  const input =
    "min-h-12 w-full rounded-[14px] border border-input bg-card px-4 text-base outline-none focus-visible:border-blue";

  async function save() {
    setBusy(true);
    const res =
      kind === "poll"
        ? await post(`/api/rooms/${tripId}/polls`, { question, options: options.filter((o) => o.trim()) })
        : await post(`/api/rooms/${tripId}/pin`, { text: pin.trim() || null }, "PUT");
    setBusy(false);
    if (res?.ok) {
      haptic.success();
      onClose();
    }
  }

  return (
    <Panel className="fixed inset-x-3 bottom-24 z-30 mx-auto flex max-w-[456px] flex-col gap-3 shadow-xl">
      <Display as="h2" className="text-2xl">
        {kind === "poll" ? t("newPoll") : t("newPin")}
      </Display>
      {kind === "poll" ? (
        <>
          <input
            aria-label={t("question")}
            placeholder={t("question")}
            value={question}
            maxLength={140}
            onChange={(e) => setQuestion(e.target.value)}
            className={input}
          />
          {options.map((o, i) => (
            <input
              key={i}
              aria-label={t("option", { n: i + 1 })}
              placeholder={t("option", { n: i + 1 })}
              value={o}
              maxLength={60}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              className={input}
            />
          ))}
          {options.length < 4 && (
            <button
              type="button"
              onClick={() => setOptions([...options, ""])}
              className="min-h-11 self-start text-sm font-medium text-blue"
            >
              + {t("addOption")}
            </button>
          )}
        </>
      ) : (
        <input
          aria-label={t("newPin")}
          placeholder={t("pinPlaceholder")}
          value={pin}
          maxLength={200}
          onChange={(e) => setPin(e.target.value)}
          className={input}
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 flex-1 rounded-[14px] border border-input font-medium"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={
            busy ||
            (kind === "poll" && (question.trim().length < 3 || options.filter((o) => o.trim()).length < 2))
          }
          onClick={save}
          className="min-h-12 flex-1 rounded-[14px] bg-ink font-semibold text-white disabled:opacity-40"
        >
          {t("save")}
        </button>
      </div>
    </Panel>
  );
}
