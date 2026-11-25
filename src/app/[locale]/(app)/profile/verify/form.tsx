"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Panel } from "@/components/clay";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";

export function VerifyForm({ retry }: { retry: boolean }) {
  const t = useTranslations("verifyId");
  const router = useRouter();
  const [doc, setDoc] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [state, setState] = useState<"idle" | "busy" | "done" | "invalid" | "image" | "network">("idle");

  async function send() {
    if (!doc || !selfie) return setState("invalid");
    setState("busy");
    const body = new FormData();
    body.set("document", doc);
    body.set("selfie", selfie);
    const res = await fetch("/api/profile/id", { method: "POST", body }).catch(() => null);
    if (res?.ok) {
      haptic.success();
      setState("done");
      router.refresh();
      return;
    }
    haptic.error();
    const e = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "network";
    setState(
      e === "too_big" || e === "unreadable" || e === "not_image"
        ? "image"
        : e === "invalid"
          ? "invalid"
          : "network",
    );
  }

  const pick =
    "press flex min-h-12 w-full items-center rounded-[14px] border border-input bg-background px-4 text-left text-[15px]";
  return (
    <Panel className="flex flex-col gap-4">
      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t("step1")}</span>
        <span className="text-sm text-muted-foreground">{t("step1Hint")}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label={t("chooseDoc")}
          onChange={(e) => setDoc(e.target.files?.[0] ?? null)}
          className={pick}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-semibold">{t("step2")}</span>
        <span className="text-sm text-muted-foreground">{t("step2Hint")}</span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          aria-label={t("chooseSelfie")}
          onChange={(e) => setSelfie(e.target.files?.[0] ?? null)}
          className={pick}
        />
      </label>
      {(state === "invalid" || state === "image" || state === "network") && (
        <p role="alert" className="text-sm text-danger">
          {state === "invalid" ? t("errInvalid") : state === "image" ? t("errImage") : t("errNetwork")}
        </p>
      )}
      <button
        type="button"
        onClick={send}
        disabled={state === "busy"}
        className="press min-h-[52px] rounded-button bg-ink px-4 font-semibold text-white disabled:opacity-60"
      >
        {state === "busy" ? t("sending") : state === "done" ? t("done") : retry ? t("retry") : t("send")}
      </button>
    </Panel>
  );
}
