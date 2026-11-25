"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

/** "Yozish": opens (or creates) the private conversation with this person. */
export function ChatStart({ userId }: { userId: string }) {
  const t = useTranslations("chats");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="px-2 pt-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setFailed(false);
          const res = await fetch("/api/chats", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ userId }),
          }).catch(() => null);
          if (res?.ok) router.push(`/chats/${((await res.json()) as { id: string }).id}`);
          else {
            setFailed(true);
            setBusy(false);
          }
        }}
        className="press inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-button bg-ink px-4 font-semibold text-white disabled:opacity-60"
      >
        <MessageCircle className="size-5" aria-hidden="true" />
        {t("write")}
      </button>
      {failed && (
        <p role="alert" className="pt-2 text-sm text-danger">
          {t("cantWrite")}
        </p>
      )}
    </div>
  );
}
