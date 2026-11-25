"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { clayInput, Display, Panel } from "@/components/clay";
import { BackAction, MainAction } from "@/components/telegram-actions";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

export function RegisterForm() {
  const t = useTranslations("agency");
  const router = useRouter();
  const [v, setV] = useState({
    name: "",
    legalName: "",
    taxId: "",
    phone: "",
    website: "",
    description: "",
    city: "",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) =>
    setV({ ...v, [k]: e.target.value });

  async function submit() {
    setPending(true);
    setError(null);
    const res = await fetch("/api/agency", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ op: "register", agency: { ...v, country: "UZ" } }),
    }).catch(() => null);
    setPending(false);
    if (res?.ok) {
      haptic.success();
      router.push("/agency");
      return;
    }
    haptic.error();
    const e = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "x";
    setError(e === "phone_required" ? t("errPhone") : e === "already" ? t("errAlready") : t("errGeneric"));
  }

  const field = (k: keyof typeof v, label: string, area = false) => (
    <label className="flex flex-col gap-1">
      <span className="font-semibold">{label}</span>
      {area ? (
        <textarea
          value={v[k]}
          onChange={set(k)}
          rows={3}
          maxLength={800}
          className={cn(clayInput, "rounded-[18px] py-3")}
        />
      ) : (
        <input value={v[k]} onChange={set(k)} maxLength={120} className={clayInput} />
      )}
    </label>
  );
  return (
    <>
      <div className="relative flex min-h-11 items-center justify-center px-20 text-center">
        <BackAction
          label={t("title")}
          onClick={() => router.push("/agency")}
          className="absolute top-1/2 left-0 min-h-11 -translate-y-1/2 px-1 text-[15px] font-medium text-blue"
        />
      </div>
      <Display className="px-1 pt-2 text-[32px]">{t("registerTitle")}</Display>
      <p className="px-1 text-[15px] text-muted-foreground">{t("registerLead")}</p>
      <Panel className="flex flex-col gap-3">
        {field("name", t("name"))}
        {field("legalName", t("legalName"))}
        {field("taxId", t("taxId"))}
        {field("phone", t("phone"))}
        {field("website", t("website"))}
        {field("city", t("city"))}
        {field("description", t("description"), true)}
      </Panel>
      {error && (
        <p role="alert" className="rounded-[18px] bg-danger-soft p-4 text-sm text-danger">
          {error}
        </p>
      )}
      <MainAction
        label={t("submit")}
        onClick={submit}
        loading={pending}
        disabled={v.name.trim().length < 3 || v.phone.trim().length < 7}
      />
    </>
  );
}
