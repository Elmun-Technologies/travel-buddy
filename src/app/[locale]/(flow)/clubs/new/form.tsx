"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Chip, clayInput, Display, Panel } from "@/components/clay";
import { BackAction, MainAction } from "@/components/telegram-actions";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

export function NewClubForm() {
  const t = useTranslations("clubsUi");
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [city, setCity] = useState("");
  const [privacy, setPrivacy] = useState<"open" | "closed">("open");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (pending) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/clubs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, description, rules, city, privacy }),
    }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      haptic.celebrate();
      router.push(`/clubs/${((await res.json()) as { id: string }).id}`);
      return;
    }
    haptic.error();
    const e = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "network";
    setError(e === "phone_required" ? t("errPhone") : e === "too_many" ? t("errMany") : t("errGeneric"));
  }

  return (
    <>
      <div className="relative flex min-h-11 flex-col items-center justify-center px-20 text-center">
        <BackAction
          label={t("back")}
          onClick={() => router.push("/clubs")}
          className="absolute top-1/2 left-0 min-h-11 -translate-y-1/2 px-1 text-[15px] font-medium text-blue"
        />
        <span className="leading-tight font-semibold">{t("newTitle")}</span>
      </div>
      <Display className="px-1 pt-2 text-[34px]">{t("newTitle")}</Display>
      <Panel className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t("name")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder={t("namePh")}
            className={clayInput}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t("desc")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={600}
            rows={3}
            placeholder={t("descPh")}
            className={cn(clayInput, "min-h-24 rounded-[18px] py-3")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t("rulesLabel")}</span>
          <textarea
            value={rules}
            onChange={(e) => setRules(e.target.value)}
            maxLength={600}
            rows={2}
            className={cn(clayInput, "rounded-[18px] py-3")}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-semibold">{t("city")}</span>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={60}
            className={clayInput}
          />
        </label>
        <div className="flex flex-col gap-2">
          <span className="font-semibold">{t("privacy")}</span>
          <div className="flex flex-wrap gap-2">
            <Chip on={privacy === "open"} onClick={() => setPrivacy("open")}>
              {t("privacyOpen")}
            </Chip>
            <Chip on={privacy === "closed"} onClick={() => setPrivacy("closed")}>
              {t("privacyClosed")}
            </Chip>
          </div>
        </div>
      </Panel>
      {error && (
        <p role="alert" className="rounded-[18px] bg-danger-soft p-4 text-sm text-danger">
          {error}
        </p>
      )}
      <MainAction label={t("save")} onClick={save} loading={pending} disabled={name.trim().length < 3} />
    </>
  );
}
