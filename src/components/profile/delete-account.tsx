"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/clay";

/** Tasdiqlash oynasi: akkauntni o'chirish. Ochilganda API ga POST /api/profile/delete yuboradi. */
export function DeleteAccountDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  async function handleDelete() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      if (res.ok) {
        await router.replace("/");
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <Panel className="w-full max-w-md relative bg-card shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{t("deleteAccount.title")}</h2>
        <p className="mb-6 text-[15px] leading-relaxed">{t("deleteAccount.text")}</p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-danger">
            {t("deleteAccount.title")} — {tc("retry")}
          </p>
        )}
        <div className="flex flex-col gap-3">
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={pending}
            className="h-11"
          >
            {pending ? tc("saving") : t("deleteAccount.confirm")}
          </Button>
          <Button type="button" variant="outline" onClick={onClose} className="h-11">
            {tc("cancel")}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
