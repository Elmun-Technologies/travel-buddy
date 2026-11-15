import { Suspense } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { BackTo } from "@/components/telegram-actions";
import { redirect } from "@/i18n/navigation";
import { countryName } from "@/lib/catalog";
import { asLocale, requireProfile } from "@/lib/guard";
import { countryPhoto } from "@/lib/photos";
import { creatorEnabled, getMyEntries, igHandle, offerFor } from "@/modules/creator/service";
import { JoinAction } from "./join";

export default function CreatorOfferPage(props: PageProps<"/[locale]/trips/[id]/creator">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Offer {...props} />
    </Suspense>
  );
}

const eyebrow = "text-sm font-semibold tracking-[.06em] text-muted-foreground uppercase";

// App-Creator: the hidden "1M Safar" offer, reached from the day-2 bot message. Members only.
async function Offer({ params }: PageProps<"/[locale]/trips/[id]/creator">) {
  await connection(); // the flag is a runtime env, never baked at build
  if (!creatorEnabled()) notFound();
  const { locale: l, id } = await params;
  const locale = asLocale(l);
  const { user } = await requireProfile(locale);
  const tripId = z.uuid().safeParse(id);
  const trip = tripId.success ? await offerFor(user.id, tripId.data) : null;
  if (!trip) return redirect({ href: tripId.success ? `/trips/${id}` : "/rooms", locale });
  const joined = (await getMyEntries(user.id)).some((e) => e.tripId === trip.id);
  const t = await getTranslations("creator");
  const country = countryName(trip.country, locale);

  return (
    <>
      <BackTo label={t("back")} href={`/trips/${trip.id}/room`} />
      <div className="-mt-2 text-center">
        <h1 className="font-semibold">{t("title")}</h1>
        <div className="text-xs text-muted-foreground">{t("sub")}</div>
      </div>

      <Panel tone="dark" className="flex flex-col gap-5 p-5">
        <span className="self-start rounded-full bg-signal px-3 py-1.5 text-sm font-medium text-ink">
          {t("badge", { country })}
        </span>
        <Display as="h2" className="text-[52px] leading-[1.02]">
          {t("h1a")}
          <br />
          {t("h1b")}
          <br />
          {t("h1c")}
        </Display>
        <div className="flex justify-center gap-3" aria-hidden="true">
          {[countryPhoto(trip.country, 400), countryPhoto(trip.country === "GE" ? "TR" : "GE", 400)].map(
            (src) => (
              <span key={src} className="relative aspect-[9/16] w-[42%] overflow-hidden rounded-[22px]">
                <Image src={src} alt="" fill sizes="200px" className="object-cover" />
                <span className="absolute bottom-3 left-3 text-lg text-white">▶</span>
              </span>
            ),
          )}
        </div>
        <p className="text-lg leading-relaxed text-white/80">
          {t.rich("lead", { b: (c) => <b className="whitespace-nowrap text-white">{c}</b> })}
        </p>
      </Panel>

      <div className="grid grid-cols-3 gap-2">
        {(["1", "2", "3"] as const).map((k) => (
          <Panel key={k} tone={k === "3" ? "signal" : "light"} className="p-4">
            <div className="font-display text-[32px] leading-none">{t(`s${k}v`)}</div>
            <div className={k === "3" ? "mt-1 text-sm" : "mt-1 text-sm text-muted-foreground"}>
              {t(`s${k}`)}
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="flex flex-col gap-4 p-6">
        <h3 className={eyebrow}>{t("how")}</h3>
        <ol className="flex flex-col gap-4">
          {(["1", "2", "3", "4"] as const).map((k) => (
            <li key={k} className="flex gap-5">
              <span className="font-display text-[40px] leading-none">0{k}</span>
              <span>
                <span className="block text-xl font-semibold">{t(`how${k}t`)}</span>
                <span className="text-muted-foreground">{t(`how${k}`, { handle: igHandle() })}</span>
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel className="flex flex-col gap-3 p-6">
        <h3 className={eyebrow}>{t("rule")}</h3>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xl">{t("ruleLine")}</span>
          <span className="flex-none rounded-[12px] bg-signal px-2 font-display text-[40px] leading-tight whitespace-nowrap">
            {t("s1v")}
          </span>
        </div>
        <p className="text-muted-foreground">{t("ruleNote")}</p>
      </Panel>

      <Panel className="p-0">
        <details className="group">
          <summary className="flex min-h-16 cursor-pointer items-center gap-3 px-6 text-xl font-semibold">
            <span className="transition-transform group-open:rotate-90">▶</span>
            {t("rules")}
          </summary>
          <ul className="flex list-disc flex-col gap-2 px-10 pb-6 text-muted-foreground">
            {(["1", "2", "3", "4", "5", "6"] as const).map((k) => (
              <li key={k}>{t(`r${k}`)}</li>
            ))}
          </ul>
        </details>
      </Panel>

      <JoinAction tripId={trip.id} joined={joined} />
      <p className="pb-4 text-center text-sm text-muted-foreground">{t("igNote")}</p>
    </>
  );
}
