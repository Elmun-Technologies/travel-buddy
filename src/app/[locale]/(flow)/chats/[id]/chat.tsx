"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ReportLink } from "@/components/report-link";
import { BackAction } from "@/components/telegram-actions";
import { Link, useRouter } from "@/i18n/navigation";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/modules/chat/service";

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** One private conversation: live messages, text and photos, report and block. */
export function ChatView({
  id,
  me,
  other,
  initial,
  canWrite: canWriteInitial,
  photos,
  backHref,
}: {
  id: string;
  me: string;
  other: { id: string | null; name: string };
  initial: ChatMessage[];
  canWrite: boolean;
  photos: boolean;
  backHref: string;
}) {
  const t = useTranslations("chats");
  const tr = useTranslations("room");
  const router = useRouter();
  const [msgs, setMsgs] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(canWriteInitial);
  const [focus, setFocus] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/chats/${id}/stream`);
    es.addEventListener("message", (e) => {
      const m = JSON.parse((e as MessageEvent).data) as ChatMessage;
      if (m.senderId !== me && document.visibilityState === "visible") sound.pop();
      setMsgs((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
    });
    return () => es.close();
  }, [id, me]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const add = (m: ChatMessage) => setMsgs((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
  const fail = (status?: number) => {
    if (status === 403) setCanWrite(false);
    setError(status === 429 ? tr("slowDown") : status === 403 ? t("cantWrite") : tr("sendFailed"));
  };

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    const res = await fetch(`/api/chats/${id}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    if (!res?.ok) {
      setText(body);
      return fail(res?.status);
    }
    setError(null);
    sound.send();
    const { id: msgId } = (await res.json()) as { id: string };
    add({
      id: msgId,
      senderId: me,
      name: "",
      body,
      kind: "text",
      pollId: null,
      at: new Date().toISOString(),
    });
  }

  async function sendPhoto(f: File) {
    const body = new FormData();
    body.set("file", f);
    const res = await fetch(`/api/chats/${id}/images`, { method: "POST", body }).catch(() => null);
    if (!res?.ok) return fail(res?.status);
    setError(null);
    sound.send();
    const { id: msgId } = (await res.json()) as { id: string };
    add({
      id: msgId,
      senderId: me,
      name: "",
      body: "",
      kind: "image",
      pollId: null,
      at: new Date().toISOString(),
    });
  }

  async function block() {
    if (!other.id) return;
    const res = await fetch("/api/blocks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: other.id }),
    }).catch(() => null);
    if (res?.ok) router.replace("/rooms");
  }

  return (
    <>
      <div className="relative flex min-h-11 flex-col items-center justify-center px-20 text-center">
        <BackAction
          label={tr("back")}
          onClick={() => router.push(backHref)}
          className="absolute top-1/2 left-0 min-h-11 -translate-y-1/2 px-1 text-[15px] font-medium text-blue"
        />
        {other.id ? (
          <Link href={`/u/${other.id}`} className="leading-tight font-semibold">
            {other.name}
          </Link>
        ) : (
          <span className="leading-tight font-semibold">{other.name}</span>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-2 pb-36">
        {msgs.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">{t("empty", { name: other.name })}</p>
        )}
        {msgs.map((m) => {
          const mine = m.senderId === me;
          return (
            <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-[18px] px-3.5 py-2.5",
                  mine ? "bg-blue text-white" : "bg-card",
                )}
              >
                {m.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element -- compressed WebP behind a membership check
                  <img
                    src={`/api/media/message/${m.id}`}
                    alt={tr("photoAlt")}
                    loading="lazy"
                    className="max-h-72 w-full rounded-[12px] object-cover"
                  />
                ) : (
                  <button
                    type="button"
                    disabled={mine}
                    onClick={() => setFocus(focus === m.id ? null : m.id)}
                    className="block text-left text-[16px] whitespace-pre-wrap"
                  >
                    {m.body}
                  </button>
                )}
                <div
                  className={cn("text-right text-[11px]", mine ? "text-white/70" : "text-muted-foreground")}
                >
                  {time(m.at)}
                </div>
                {focus === m.id && !mine && (
                  <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
                    <ReportLink targetType="message" targetId={m.id} />
                    <button type="button" onClick={block} className="min-h-11 self-start text-sm text-danger">
                      {tr("block", { name: other.name })}
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {error && <p className="px-4 pt-2 text-sm text-danger">{error}</p>}
        {canWrite ? (
          <form
            className="mx-auto flex max-w-[480px] items-center gap-2 px-3 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {photos && (
              <>
                <input
                  ref={file}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  aria-label={tr("photo")}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void sendPhoto(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  aria-label={tr("photo")}
                  onClick={() => file.current?.click()}
                  className="flex size-12 flex-none items-center justify-center rounded-full border border-input"
                >
                  <ImagePlus className="size-5" aria-hidden="true" />
                </button>
              </>
            )}
            <label htmlFor="chat-input" className="sr-only">
              {t("placeholder")}
            </label>
            <input
              id="chat-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              autoComplete="off"
              placeholder={t("placeholder")}
              className="min-h-12 flex-1 rounded-full bg-background px-5 text-base outline-none"
            />
            <button
              type="submit"
              aria-label={tr("send")}
              className="flex size-12 flex-none items-center justify-center rounded-full bg-ink text-white"
            >
              <ArrowRight className="size-5" aria-hidden="true" />
            </button>
          </form>
        ) : (
          <p className="mx-auto max-w-[480px] px-4 pt-3 text-center text-sm text-muted-foreground">
            {t("cantWrite")}
          </p>
        )}
      </div>
    </>
  );
}
