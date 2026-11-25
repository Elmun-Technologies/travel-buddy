"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/clay";
import { useRouter } from "@/i18n/navigation";
import { openExternal } from "@/lib/telegram-webapp";

type Status = {
  isOrganizer: boolean;
  linked: boolean;
  chatTitle: string | null;
  code: string | null;
  codeExpires: string | null;
};

async function call(tripId: string, op: "code" | "unlink" | "invite") {
  const res = await fetch(`/api/trips/${tripId}/telegram`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ op }),
  }).catch(() => null);
  return {
    ok: !!res?.ok,
    data: (await res?.json().catch(() => ({}))) as { code?: string; link?: string; error?: string },
  };
}

export function GroupPanel({ tripId, status, bot }: { tripId: string; status: Status; bot: string }) {
  const t = useTranslations("tgGroup");
  const router = useRouter();
  const [code, setCode] = useState(status.code);
  const [msg, setMsg] = useState<string | null>(null);
  const btn = "press min-h-[52px] w-full rounded-button px-4 font-semibold disabled:opacity-60";

  if (status.linked)
    return (
      <>
        <Panel tone="soft" className="flex flex-col gap-1">
          <span className="font-semibold">{t("linked")}</span>
          {status.chatTitle && <span className="text-sm">{status.chatTitle}</span>}
          <span className="text-sm text-muted-foreground">{t("whatPosts")}</span>
        </Panel>
        <button
          type="button"
          className={`${btn} bg-ink text-white`}
          onClick={async () => {
            setMsg(null);
            const r = await call(tripId, "invite");
            if (r.ok && r.data.link) openExternal(r.data.link);
            else setMsg(r.data.error === "bot_not_admin" ? t("errAdmin") : t("errGeneric"));
          }}
        >
          {t("join")}
        </button>
        {msg && (
          <p role="alert" className="text-sm text-danger">
            {msg}
          </p>
        )}
        <p className="px-1 text-[13px] text-muted-foreground">{t("joinHint")}</p>
        {status.isOrganizer && (
          <button
            type="button"
            className="min-h-11 self-start px-1 text-sm text-danger underline"
            onClick={async () => {
              if ((await call(tripId, "unlink")).ok) router.refresh();
            }}
          >
            {t("unlink")}
          </button>
        )}
      </>
    );

  if (!status.isOrganizer) return <Panel className="text-[15px] text-muted-foreground">{t("notYet")}</Panel>;
  return (
    <>
      <Panel className="flex flex-col gap-2 text-[15px]">
        <p>{t("step1", { bot: bot ? `@${bot}` : "" })}</p>
        <p>{t("step2")}</p>
        <p>{t("step3")}</p>
      </Panel>
      {code ? (
        <Panel tone="dark" className="flex flex-col gap-2">
          <span className="text-sm text-white/70">{t("codeLabel")}</span>
          <code className="font-display text-[34px] tracking-[.12em] select-all">/link {code}</code>
          <span className="text-sm text-white/70">{t("codeNote")}</span>
        </Panel>
      ) : null}
      <button
        type="button"
        className={`${btn} ${code ? "border border-input bg-card" : "bg-ink text-white"}`}
        onClick={async () => {
          const r = await call(tripId, "code");
          if (r.ok && r.data.code) setCode(r.data.code);
          else setMsg(t("errGeneric"));
        }}
      >
        {code ? t("newCode") : t("getCode")}
      </button>
      {code && (
        <button
          type="button"
          className="min-h-11 self-start px-1 text-sm underline"
          onClick={() => router.refresh()}
        >
          {t("check")}
        </button>
      )}
      {msg && (
        <p role="alert" className="text-sm text-danger">
          {msg}
        </p>
      )}
    </>
  );
}
