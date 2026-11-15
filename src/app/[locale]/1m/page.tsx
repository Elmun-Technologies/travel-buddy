import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { Display } from "@/components/clay";
import { Link } from "@/i18n/navigation";
import { APP_NAME } from "@/lib/config";
import { countryPhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";
import { creatorEnabled, igHandle } from "@/modules/creator/service";

// Web-Creator: terms page reached only by a personal link. Not in menus, not in the sitemap.
export const metadata: Metadata = { title: "1M Safar", robots: { index: false, follow: false } };

const card = "rounded-panel bg-card p-6 md:p-8";
const eyebrow = "text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase";
const pill = "press inline-flex min-h-11 items-center gap-1 rounded-full px-5 text-[15px] font-medium";

// ponytail: "Shu oy qoplanganlar" + monthly fund left out until real payouts exist (no sample Reels on prod).
async function CreatorTerms() {
  await connection(); // the flag is a runtime env, not baked at build
  if (!creatorEnabled()) notFound();
  const t = await getTranslations("creator");
  const w = (k: string) => t(`web.${k}` as "web.badge");
  return (
    <div className="min-h-full p-4">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3">
        <header className="flex items-center justify-between rounded-full bg-card py-2 pr-2 pl-6">
          <span className="font-medium">{APP_NAME}</span>
          <Link href="/creator" className={cn(pill, "bg-ink text-white")}>
            {t("join")}
          </Link>
        </header>

        <section className="grid gap-8 rounded-panel bg-ink p-6 text-white md:grid-cols-2 md:p-12">
          <div className="flex flex-col items-start gap-6">
            <span className="rounded-full bg-signal px-3 py-1 text-xs font-medium text-ink">
              {w("badge")}
            </span>
            <Display className="text-[clamp(52px,6vw,88px)] leading-[1.02]">
              {t("h1a")}
              <br />
              {w("h1b")}
            </Display>
            <p className="max-w-[520px] text-lg text-white/75">
              {t.rich("web.lead", { b: (c) => <b className="whitespace-nowrap text-white">{c}</b> })}
            </p>
            <div className="flex gap-2">
              <Link href="/creator" className={cn(pill, "bg-signal text-ink")}>
                {t("join")}
              </Link>
              <a href="#rules" className={cn(pill, "border border-white/60")}>
                {w("rules")}
              </a>
            </div>
          </div>
          <div className="flex justify-center gap-4" aria-hidden="true">
            {["TR", "GE"].map((c) => (
              <span
                key={c}
                className="relative aspect-[9/16] w-[42%] max-w-[230px] overflow-hidden rounded-[24px]"
              >
                <Image src={countryPhoto(c, 400)} alt="" fill sizes="230px" className="object-cover" />
                <span className="absolute bottom-3 left-3 text-white">▶</span>
              </span>
            ))}
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(["1", "2", "3", "4"] as const).map((k) => (
            <div key={k} className={cn(card, "lift", k === "4" && "bg-ink text-white")}>
              <div className={cn("font-display text-[40px]", k === "4" && "text-signal")}>0{k}</div>
              <div className="font-display text-2xl">{w(`w${k}t`)}</div>
              <p className={cn("mt-2", k === "4" ? "text-white/75" : "text-muted-foreground")}>
                {t(`web.w${k}` as "web.w2", { handle: igHandle() })}
              </p>
            </div>
          ))}
        </div>

        <div id="rules" className="grid gap-3 md:grid-cols-2">
          <div className={card}>
            <h2 className={eyebrow}>{t("rule")}</h2>
            <Display as="div" className="mt-4 text-[clamp(56px,8vw,112px)] leading-none">
              {w("big")}
            </Display>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-lg">
              {w("eq")}
              <span className="rounded-[12px] bg-signal px-2 font-display text-[40px]">{w("gacha")}</span>
            </p>
            <p className="mt-3 text-muted-foreground">{w("eqNote")}</p>
          </div>
          <div className={card}>
            <h2 className={eyebrow}>{w("fair")}</h2>
            <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 leading-relaxed">
              {(["1", "2", "3", "4", "5"] as const).map((k) => (
                <li key={k}>{w(`f${k}`)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="relative flex min-h-[320px] items-end overflow-hidden rounded-panel p-8 text-white">
            <Image
              src={countryPhoto("UZ", 1200)}
              alt=""
              fill
              sizes="(min-width:768px) 640px, 100vw"
              className="object-cover"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <span className="relative flex flex-col items-start gap-2">
              <span className="rounded-full border border-white/60 px-3 py-1 text-xs">{w("nextStage")}</span>
              <span className="font-display text-[clamp(32px,3.5vw,44px)] leading-[1.05]">
                {w("inboundT")}
              </span>
            </span>
          </div>
          <div className="flex flex-col items-start justify-between gap-6 rounded-panel bg-blue p-8 text-white">
            <p className="text-xl">{w("inboundText")}</p>
            <Link href="/inbound" className={cn(pill, "bg-white text-blue")}>
              {w("concept")} ↗
            </Link>
          </div>
        </div>

        <section className="flex flex-wrap items-center justify-between gap-6 rounded-panel bg-signal p-8 md:p-12">
          <Display as="h2" className="text-[clamp(48px,6vw,88px)] leading-[1.02]">
            {w("cta1")}
            <br />
            {w("cta2")}
          </Display>
          <Link href="/creator" className={cn(pill, "bg-ink text-white")}>
            {t("join")} ↗
          </Link>
        </section>
        <p className="px-2 py-4 text-sm text-muted-foreground">{w("foot")}</p>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoading />}>
      <CreatorTerms />
    </Suspense>
  );
}
