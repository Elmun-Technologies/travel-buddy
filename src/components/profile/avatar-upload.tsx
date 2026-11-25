"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/avatar";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";

/** Profile picture: choose a photo (or take one); the server shrinks it and strips its metadata. */
export function AvatarUpload({
  userId,
  name,
  version,
  enabled,
}: {
  userId: string;
  name: string;
  version: string | null;
  enabled: boolean;
}) {
  const t = useTranslations("profile.avatar");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "busy" | string>("idle");

  async function send(file: File) {
    setState("busy");
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/profile/avatar", { method: "POST", body }).catch(() => null);
    if (res?.ok) {
      haptic.success();
      setState("idle");
      router.refresh();
      return;
    }
    haptic.error();
    const e = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "network";
    setState(
      e === "too_big" || e === "not_image" || e === "unreadable" || e === "uploads_off" ? e : "network",
    );
  }

  async function remove() {
    setState("busy");
    await fetch("/api/profile/avatar", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: "{}",
    }).catch(() => null);
    setState("idle");
    router.refresh();
  }

  if (!enabled) return null;
  return (
    <div className="mb-8 flex items-center gap-4">
      <Avatar userId={userId} name={name} version={version} className="size-20 text-2xl" />
      <div className="flex flex-col items-start gap-1">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label={t("choose")}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void send(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={state === "busy"}
          onClick={() => input.current?.click()}
          className="press inline-flex min-h-11 items-center gap-2 rounded-full border border-input px-4 text-sm font-medium disabled:opacity-60"
        >
          <Camera className="size-4" aria-hidden="true" />
          {state === "busy" ? t("uploading") : version ? t("change") : t("add")}
        </button>
        {version && state !== "busy" && (
          <button type="button" onClick={remove} className="min-h-11 text-sm text-muted-foreground underline">
            {t("remove")}
          </button>
        )}
        {state !== "idle" && state !== "busy" && (
          <p role="alert" className="text-sm text-danger">
            {t(`error_${state}` as "error_network")}
          </p>
        )}
      </div>
    </div>
  );
}
