import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { DocNav, docMetadata } from "@/components/legal/legal-page";
import { PageLoading } from "@/components/page-loading";
import { Link } from "@/i18n/navigation";
import { APP_NAME, legalInfo } from "@/lib/config";
import { countryName } from "@/lib/catalog";
import { asLocale } from "@/lib/guard";
import { EMERGENCY } from "@/lib/emergency";

export async function generateMetadata({ params }: PageProps<"/[locale]/support">): Promise<Metadata> {
  return docMetadata("support", (await params).locale);
}

export default function SupportPage(props: PageProps<"/[locale]/support">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Support {...props} />
    </Suspense>
  );
}

const BOT_LINK = "/api/bot"; // → t.me/<bot>
const fill = (s: string) => s.replaceAll("{app}", APP_NAME);

async function Support({ params }: PageProps<"/[locale]/support">) {
  await connection(); // contacts are runtime env
  const locale = asLocale((await params).locale);
  const t = await getTranslations({ locale, namespace: "legal" });
  const info = legalInfo();
  const faq = t.raw("support.faq") as { h: string; p: string[] }[];
  // Country names come from Intl on the server (some WebViews lack Uzbek region names).
  const countries = Object.entries(EMERGENCY)
    .map(([code, e]) => ({ code, name: countryName(code, locale), e }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  const pill = "press inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-medium";
  return (
    <>
      <DocNav current="support" />
      <header className="flex flex-col gap-3 px-1 py-4">
        <Display className="text-[clamp(36px,8vw,56px)] leading-[1.02]">{t("support.title")}</Display>
        <p className="text-[17px] leading-relaxed text-muted-foreground">{t("support.lead")}</p>
      </header>

      <Panel tone="dark" className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">{t("support.contactTitle")}</h2>
        {!info.email && !info.telegram && (
          <p className="text-[15px] text-white/80">{t("support.contactNone")}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {info.telegram && (
            <a href={`https://t.me/${info.telegram}`} className={`${pill} bg-signal text-ink`}>
              {t("contactTelegram")}
            </a>
          )}
          {info.email && (
            <a href={`mailto:${info.email}`} className={`${pill} bg-white text-ink`}>
              {info.email}
            </a>
          )}
          <a href={BOT_LINK} className={`${pill} border border-white/40 text-white`}>
            {t("support.botLink")}
          </a>
        </div>
      </Panel>

      {faq.map((f) => (
        <Panel key={f.h} className="flex flex-col gap-2">
          <h2 className="font-display text-2xl">{fill(f.h)}</h2>
          {f.p.map((p) => (
            <p key={p} className="text-[15px] leading-relaxed">
              {fill(p)}
            </p>
          ))}
        </Panel>
      ))}

      <Panel className="flex flex-col gap-3">
        <h2 className="font-display text-2xl">{t("support.emergencyTitle")}</h2>
        <p className="text-[15px] text-muted-foreground">{t("support.emergencyLead")}</p>
        <ul className="flex flex-col">
          {countries.map(({ code, name, e }) => (
            <li
              key={code}
              className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 border-b border-line py-2 text-[15px] last:border-b-0"
            >
              <span>{name}</span>
              <span className="font-medium tabular-nums">
                {"all" in e
                  ? `${t("support.all")}: ${e.all}`
                  : `${t("support.police")}: ${e.police} · ${t("support.ambulance")}: ${e.ambulance}`}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t("support.emergencyNote")}</p>
      </Panel>

      <Link href="/" className="inline-flex min-h-11 items-center self-start px-1 font-medium underline">
        {t("back")}
      </Link>
    </>
  );
}
