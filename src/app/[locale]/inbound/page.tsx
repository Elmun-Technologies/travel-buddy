import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { Display } from "@/components/clay";
import { countryName } from "@/lib/catalog";
import { APP_NAME } from "@/lib/config";
import { asLocale } from "@/lib/guard";
import { countryPhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";
import { creatorEnabled } from "@/modules/creator/service";

// Web-Inbound: "Film Uzbekistan" concept for tourism boards. Says "concept" until a contract is signed.
export const metadata: Metadata = { title: "Film Uzbekistan", robots: { index: false, follow: false } };

const card = "rounded-panel bg-card p-6 md:p-8";
const pill = "press inline-flex min-h-11 items-center rounded-full px-5 text-[15px] font-medium";
const contact = "/api/bot"; // → t.me/<bot>

async function Inbound({ params }: PageProps<"/[locale]/inbound">) {
  await connection(); // the flag is a runtime env, not baked at build
  if (!creatorEnabled()) notFound();
  const locale = asLocale((await params).locale);
  const t = await getTranslations("inbound");
  return (
    <div className="min-h-full p-4">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3">
        <header className="flex items-center justify-between rounded-full bg-card py-2 pr-2 pl-6">
          <span className="font-medium">
            {APP_NAME} · {t("brand")}
          </span>
          <a href={contact} className={cn(pill, "bg-ink text-white")}>
            {t("contact")}
          </a>
        </header>

        <section className="relative flex min-h-[560px] items-end overflow-hidden rounded-panel p-6 text-white md:p-12">
          <Image src={countryPhoto("UZ", 1200)} alt="" fill priority sizes="100vw" className="object-cover" />
          <span className="absolute inset-0 bg-gradient-to-r from-black/55 to-black/5" />
          <div className="relative flex max-w-[720px] flex-col items-start gap-5">
            <span className="rounded-full bg-signal px-3 py-1 text-xs font-medium text-ink">
              {t("badge")}
            </span>
            <Display className="text-[clamp(52px,8vw,112px)] leading-[1.0]">
              {t("h1a")}
              <br />
              {t("h1b")}
            </Display>
            <p className="max-w-[620px] text-lg text-white/90">{t("lead")}</p>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["1", "2", "3", "4"] as const).map((k) => (
            <div key={k} className={cn(card, "lift", k === "4" && "bg-ink text-white")}>
              <div className={cn("font-display text-[44px]", k === "4" && "text-signal")}>0{k}</div>
              <div className="font-display text-2xl">{t(`s${k}t`)}</div>
              <p className={cn("mt-2", k === "4" ? "text-white/75" : "text-muted-foreground")}>
                {t(`s${k}`)}
              </p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className={card}>
            <h2 className="text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase">
              {t("boards")}
            </h2>
            <Display as="div" className="mt-3 text-[clamp(36px,4vw,48px)] leading-[1.05]">
              {t("boardsT")}
            </Display>
            <p className="mt-4 text-lg text-muted-foreground">{t("boardsText")}</p>
          </div>
          <div className="grid grid-cols-2 gap-6 rounded-panel bg-ink p-8 text-white">
            {(["1", "2", "3", "4"] as const).map((k) => (
              <div key={k}>
                <div className={cn("font-display text-[52px] leading-none", k === "1" && "text-signal")}>
                  {t(`k${k}v`)}
                </div>
                <div className="mt-1 text-white/75">{t(`k${k}`)}</div>
              </div>
            ))}
          </div>
        </div>

        <section className={card}>
          <Display as="h2" className="text-[clamp(36px,4vw,48px)]">
            {t("many")}
          </Display>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["UZ", "KZ", "GE", "TR"].map((c) => (
              <div key={c} className="lift overflow-hidden rounded-[20px] bg-background">
                <span className="relative block aspect-[16/9]">
                  <Image src={countryPhoto(c, 400)} alt="" fill sizes="300px" className="object-cover" />
                </span>
                <div className="px-4 py-3">
                  <div className="font-semibold">{countryName(c, locale)}</div>
                  <div className="text-sm text-muted-foreground">{c === "UZ" ? t("pilot") : t("next")}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-6 rounded-panel bg-blue p-8 text-white md:p-12">
          <Display as="h2" className="text-[clamp(48px,6vw,88px)] leading-none">
            {t("cta")}
          </Display>
          <a href={contact} className={cn(pill, "bg-white text-blue")}>
            {t("deck")} ↗
          </a>
        </section>
        <p className="px-2 py-4 text-sm text-muted-foreground">{t("foot")}</p>
      </div>
    </div>
  );
}

export default function Page(props: PageProps<"/[locale]/inbound">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Inbound {...props} />
    </Suspense>
  );
}
