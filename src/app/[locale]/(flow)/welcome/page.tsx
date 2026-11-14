import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ArrowBadge, CheckIcon, Display, Panel, Tag } from "@/components/clay";
import { LocaleSwitch } from "@/components/locale-switch";
import { MainAction } from "@/components/telegram-actions";

// First Mini App screen (App-Welcome.png): what this is, three steps, why it is safe, one action.
export default async function WelcomePage({ searchParams }: PageProps<"/[locale]/welcome">) {
  const t = await getTranslations("welcome");
  return (
    <>
      <LocaleSwitch />
      <Panel className="flex flex-col gap-[18px] p-[22px]">
        <Tag tone="soft" className="self-start px-3 py-1.5 text-sm">
          {t("badge")}
        </Tag>
        <Display className="text-[40px]">{t("title")}</Display>
        <p className="text-[15px] leading-relaxed text-muted-foreground">{t("lead")}</p>
      </Panel>

      <div className="grid grid-cols-2 gap-2">
        <Panel tone="blue" className="flex min-h-[132px] flex-col justify-between">
          <Display as="span" className="text-[22px]">
            01.
          </Display>
          <div>
            <div className="font-semibold">{t("s1")}</div>
            <div className="mt-0.5 text-[13px] opacity-90">{t("s1hint")}</div>
          </div>
        </Panel>
        <Panel className="flex min-h-[132px] flex-col justify-between">
          <Display as="span" className="text-[22px]">
            02.
          </Display>
          <div>
            <div className="font-semibold">{t("s2")}</div>
            <div className="mt-0.5 text-[13px] text-muted-foreground">{t("s2hint")}</div>
          </div>
        </Panel>
        <Panel tone="dark" className="col-span-2 flex items-center justify-between gap-3">
          <div>
            <Display as="span" className="text-[22px] text-signal">
              03.
            </Display>
            <div className="mt-2 font-semibold">{t("s3")}</div>
            <div className="mt-0.5 text-[13px] text-[#c9c9c9]">{t("s3hint")}</div>
          </div>
          <ArrowBadge />
        </Panel>
      </div>

      <Panel className="flex flex-col gap-2.5">
        <div className="text-[13px] font-semibold">{t("trustTitle")}</div>
        <ul className="flex flex-wrap gap-1.5">
          {(["trust1", "trust2", "trust3", "trust4"] as const).map((k) => (
            <li key={k}>
              <Tag className="px-3 py-1.5 text-sm">
                <CheckIcon />
                {t(k)}
              </Tag>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("phoneHidden")}</p>
      </Panel>

      <Suspense fallback={<MainAction label={t("cta")} disabled />}>
        <Start label={t("cta")} searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** "Boshladik!" keeps ?name= from the Telegram login (prefills onboarding step 1). */
async function Start({
  label,
  searchParams,
}: {
  label: string;
  searchParams: PageProps<"/[locale]/welcome">["searchParams"];
}) {
  const sp = await searchParams;
  const p = new URLSearchParams();
  if (typeof sp.name === "string" && sp.name) p.set("name", sp.name.slice(0, 50));
  if (typeof sp.next === "string" && /^\/trips\/[0-9a-f-]{36}$/.test(sp.next)) p.set("next", sp.next);
  const q = p.size ? `?${p}` : "";
  return <MainAction label={label} href={`/onboarding${q}`} />;
}
