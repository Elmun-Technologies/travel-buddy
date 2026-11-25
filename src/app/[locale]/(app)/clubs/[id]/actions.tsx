"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clayInput } from "@/components/clay";
import { useRouter } from "@/i18n/navigation";

async function act(clubId: string, body: unknown) {
  return fetch(`/api/clubs/${clubId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

export function ClubActions({
  clubId,
  status,
  isOrganizer,
  privacy,
}: {
  clubId: string;
  status: string | null;
  isOrganizer: boolean;
  privacy: "open" | "closed";
}) {
  const t = useTranslations("clubsUi");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (body: unknown) => {
    setBusy(true);
    await act(clubId, body);
    setBusy(false);
    router.refresh();
  };
  if (status === "approved")
    return (
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-signal px-3 py-1 text-sm font-semibold text-ink">{t("member")}</span>
        {!isOrganizer && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ op: "leave" })}
            className="min-h-11 text-sm text-white/80 underline"
          >
            {t("leave")}
          </button>
        )}
      </div>
    );
  if (status === "requested") return <span className="text-sm text-white/80">{t("requested")}</span>;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => run({ op: "join" })}
      className="press min-h-12 self-start rounded-full bg-signal px-6 font-semibold text-ink disabled:opacity-60"
    >
      {privacy === "open" ? t("join") : t("joinRequest")}
    </button>
  );
}

export function RequestButtons({ clubId, userId }: { clubId: string; userId: string }) {
  const t = useTranslations("clubsUi");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const run = async (op: "approve" | "reject") => {
    setBusy(true);
    await act(clubId, { op, userId });
    router.refresh();
  };
  return (
    <span className="flex gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={() => run("approve")}
        className="press min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-white"
      >
        {t("approve")}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => run("reject")}
        className="press min-h-11 rounded-full border border-input px-5 text-sm font-medium"
      >
        {t("reject")}
      </button>
    </span>
  );
}

export function Composer({ clubId }: { clubId: string }) {
  const t = useTranslations("clubsUi");
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        setBusy(true);
        const res = await act(clubId, { op: "post", body: text });
        setBusy(false);
        if (res?.ok) {
          setText("");
          router.refresh();
        }
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        placeholder={t("postPh")}
        aria-label={t("postPh")}
        className={`${clayInput} flex-1 rounded-full`}
      />
      <button
        disabled={busy || !text.trim()}
        className="press min-h-12 rounded-full bg-ink px-5 font-semibold text-white disabled:opacity-50"
      >
        {t("post")}
      </button>
    </form>
  );
}

export function PostDelete({ clubId, id }: { clubId: string; id: string }) {
  const t = useTranslations("clubsUi");
  const router = useRouter();
  return (
    <button
      type="button"
      className="min-h-11 text-sm text-danger"
      onClick={async () => {
        if ((await act(clubId, { op: "post.delete", id }))?.ok) router.refresh();
      }}
    >
      {t("delete")}
    </button>
  );
}
