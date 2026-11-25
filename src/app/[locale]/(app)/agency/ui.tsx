"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";

async function post(body: unknown) {
  return fetch("/api/agency", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
}

export function DocUpload() {
  const t = useTranslations("agency");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={t("uploadDocs")}
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (!files.length) return;
          setBusy(true);
          setFailed(false);
          const body = new FormData();
          files.forEach((f) => body.append("file", f));
          const res = await fetch("/api/agency/documents", { method: "POST", body }).catch(() => null);
          setBusy(false);
          if (res?.ok) router.refresh();
          else setFailed(true);
        }}
      />
      <button
        type="button"
        disabled={busy}
        onClick={() => input.current?.click()}
        className="press min-h-11 self-start rounded-full bg-ink px-5 text-sm font-medium text-white disabled:opacity-60"
      >
        {busy ? t("uploading") : t("uploadDocs")}
      </button>
      {failed && (
        <p role="alert" className="text-sm text-danger">
          {t("errGeneric")}
        </p>
      )}
    </>
  );
}

export function OfferToggle({ tripId, closed }: { tripId: string; closed: boolean }) {
  const t = useTranslations("agency");
  const router = useRouter();
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center rounded-full border border-input px-4 text-sm font-medium"
      onClick={async () => {
        if ((await post({ op: closed ? "offer.open" : "offer.close", tripId }))?.ok) router.refresh();
      }}
    >
      {closed ? t("reopen") : t("close")}
    </button>
  );
}

export function LeadActions({
  leadId,
  status,
  conversationId,
}: {
  leadId: string;
  status: string;
  conversationId: string | null;
}) {
  const t = useTranslations("agency");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [amount, setAmount] = useState("");
  const run = async (action: unknown) => {
    setBusy(true);
    const res = await post({ op: "lead", leadId, action });
    setBusy(false);
    if (res?.ok) {
      setAsking(false);
      router.refresh();
    }
  };
  const btn =
    "press inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium disabled:opacity-60";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "new" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ op: "accept" })}
              className={`${btn} bg-ink text-white`}
            >
              {t("accept")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ op: "reject" })}
              className={`${btn} border border-input`}
            >
              {t("reject")}
            </button>
          </>
        )}
        {status === "accepted" && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => setAsking(true)}
              className={`${btn} bg-ink text-white`}
            >
              {t("book")}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => run({ op: "cancel" })}
              className={`${btn} border border-input`}
            >
              {t("cancel")}
            </button>
          </>
        )}
        {status === "booked" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ op: "cancel" })}
            className={`${btn} border border-input`}
          >
            {t("cancel")}
          </button>
        )}
        {conversationId && (
          <Link href={`/chats/${conversationId}`} className={`${btn} border border-input`}>
            {t("chat")}
          </Link>
        )}
      </div>
      {asking && (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void run({ op: "book", amount: Number(amount) });
          }}
        >
          <input
            type="number"
            min={0}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            aria-label={t("amountAsk")}
            placeholder={t("amount")}
            className="min-h-11 w-40 rounded-full border border-input bg-background px-4"
          />
          <button disabled={busy || amount === ""} className={`${btn} bg-ink text-white`}>
            {t("book")}
          </button>
        </form>
      )}
    </div>
  );
}
