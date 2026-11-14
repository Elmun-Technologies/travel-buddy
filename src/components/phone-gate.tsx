"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon, Display, Panel } from "@/components/clay";
import { MainAction } from "@/components/telegram-actions";
import { useRouter } from "@/i18n/navigation";
import { haptic, openExternal, tg } from "@/lib/telegram-webapp";

/** Opening a trip needs a verified phone: one tap in Telegram, the bot link on the web. */
export function PhoneGate({ bot }: { bot: string }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("create");
  const router = useRouter();
  const [waiting, setWaiting] = useState(false);

  // Coming back from the bot chat: re-check.
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const r = await fetch("/api/profile/phone", { cache: "no-store" }).catch(() => null);
      if (r?.ok && ((await r.json()) as { verified: boolean }).verified) router.refresh();
    };
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, [router]);

  function share() {
    const app = tg();
    if (!app?.requestContact) return openExternal(`https://t.me/${bot}?start=phone`);
    app.requestContact((shared) => {
      if (!shared) return;
      setWaiting(true);
      let tries = 0;
      const iv = setInterval(async () => {
        const r = await fetch("/api/profile/phone", { cache: "no-store" }).catch(() => null);
        const ok = r?.ok && ((await r.json()) as { verified: boolean }).verified;
        if (ok || ++tries > 15) {
          clearInterval(iv);
          setWaiting(false);
          if (ok) {
            haptic.success();
            router.refresh();
          }
        }
      }, 1000);
    });
  }

  return (
    <>
      <Panel className="flex flex-col gap-3">
        <Display className="text-[32px]">{tc("phoneTitle")}</Display>
        <p className="text-[15px] text-muted-foreground">{tc("phoneText")}</p>
        {(["s4p1", "s4p2", "s4p3"] as const).map((k) => (
          <div key={k} className="flex items-start gap-3 text-[15px]">
            <span className="mt-0.5 flex size-6 flex-none items-center justify-center rounded-full bg-success-soft text-success">
              <CheckIcon />
            </span>
            {t(k)}
          </div>
        ))}
        {waiting && (
          <p role="status" className="text-sm text-muted-foreground">
            {t("waiting")}
          </p>
        )}
      </Panel>
      <MainAction
        label={tg()?.requestContact ? t("share") : t("openBot")}
        onClick={share}
        loading={waiting}
      />
    </>
  );
}
