import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowIcon, CheckIcon } from "@/components/clay";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { APP_NAME } from "@/lib/config";
import { cn } from "@/lib/utils";

// Landing (docs/design-handoff/design/screens/Main.png). Bento panels, one idea per panel.
// Illustrative cards (trip, clubs, stories) carry a "Namuna" tag: no fake content passes as real.

const tag =
  "inline-flex items-center rounded-full border border-input bg-card px-3 py-1.5 text-xs font-medium text-ink";
const pill =
  "press inline-flex min-h-11 items-center gap-2 rounded-full border border-ink px-5 py-3 text-[15px] font-medium";
const h2 = "font-display text-[clamp(36px,4vw,56px)]";
const auto = (min: number) => ({ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))` });

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
  };
}

export default async function Landing() {
  const t = await getTranslations("landing");
  const tl = await getTranslations("legal");
  const locale = await getLocale();
  const start = "/api/bot"; // → t.me/<bot> (runtime env)

  return (
    <div className="min-h-full p-4">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-3">
        {/* NAV */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-full bg-card py-2.5 pr-2.5 pl-6">
          <a href="#top" className="flex items-center gap-2.5">
            <span className="size-7 rounded-full bg-ink" aria-hidden="true" />
            <span className="font-display text-xl font-medium">{APP_NAME}</span>
          </a>
          <nav className="hidden flex-wrap gap-6 text-[15px] lg:flex">
            <a href="#how" className="hover:text-blue">
              {t("nav.how")}
            </a>
            <a href="#room" className="hover:text-blue">
              {t("nav.room")}
            </a>
            <a href="#clubs" className="hover:text-blue">
              {t("nav.clubs")}
            </a>
            <a href="#stories" className="hover:text-blue">
              {t("nav.stories")}
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <span className={cn(tag, "gap-0.5 p-0.5")} role="group" aria-label="Language">
              {routing.locales.map((l) => (
                <Link
                  key={l}
                  href="/"
                  locale={l}
                  aria-current={l === locale ? "true" : undefined}
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-full px-1.5 uppercase aria-[current]:bg-ink aria-[current]:text-white"
                >
                  {l}
                </Link>
              ))}
            </span>
            <a href={start} className={cn(pill, "bg-ink text-white")}>
              {t("nav.start")}
              <ArrowIcon className="size-[18px]" />
            </a>
          </div>
        </header>

        {/* HERO */}
        <section id="top" className="grid gap-3" style={auto(520)}>
          <div className="flex min-h-[560px] flex-col justify-between gap-12 rounded-panel bg-card p-6 md:p-10">
            <div className="flex flex-wrap gap-2">
              <span className={cn(tag, "border-blue-soft bg-blue-soft text-blue-ink")}>{t("hero.soon")}</span>
              <span className={tag}>18+</span>
            </div>
            <h1 className="font-display text-[clamp(44px,6vw,84px)]">
              {t("hero.title1")}
              <br />
              {t("hero.title2")}
              <br />
              {t("hero.title3")}
            </h1>
            <div className="flex flex-col gap-6">
              <p className="max-w-[520px] text-lg leading-relaxed text-muted-foreground">{t("hero.lead")}</p>
              <div className="flex flex-wrap gap-2">
                <a href={start} className={cn(pill, "bg-ink text-white")}>
                  {t("hero.cta")}
                </a>
                <a href="#how" className={pill}>
                  {t("hero.how")}
                </a>
              </div>
            </div>
          </div>
          <div className="relative min-h-[560px] overflow-hidden rounded-panel bg-[#b9c7d6]">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP, no runtime resizing */}
            <img
              src="/photos/kazbek-1200.webp"
              alt={t("hero.photoAlt")}
              className="absolute inset-0 size-full object-cover"
              fetchPriority="high"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_45%,rgba(0,0,0,.45))]" />
            <div className="absolute inset-x-4 bottom-4 flex flex-col gap-3.5 rounded-[22px] bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className={cn(tag, "mb-2 px-2 py-0.5")}>{t("hero.sample")}</span>
                  <div className="font-display text-[28px]">{t("hero.cardTitle")}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{t("hero.cardMeta")}</div>
                </div>
                <span
                  className="flex size-14 flex-none items-center justify-center rounded-full bg-signal text-ink"
                  aria-hidden="true"
                >
                  <ArrowIcon className="size-[22px]" />
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-background">
                  <div className="h-full w-[70%] bg-blue" />
                </div>
                <span className="text-sm font-semibold">{t("hero.cardSpots")}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className={tag}>{t("hero.tag1")}</span>
                <span className={tag}>{t("hero.tag2")}</span>
                <span className={tag}>{t("hero.tag3")}</span>
              </div>
            </div>
          </div>
        </section>

        {/* BIG PILLS */}
        <section className="grid gap-3" style={auto(240)} aria-hidden="true">
          <div className="flex h-[150px] items-center justify-center rounded-full bg-blue text-white">
            <span className="font-display text-[64px] font-medium">{t("pills.buddy")}</span>
          </div>
          <div className="flex h-[150px] items-center justify-center rounded-full bg-ink text-white">
            <span className="font-display text-[64px] font-medium">{t("pills.group")}</span>
          </div>
          <div className="flex h-[150px] items-center justify-center rounded-full bg-card">
            <svg
              width="96"
              height="96"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0B0B0B"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
          </div>
          <div className="flex h-[150px] items-center justify-center rounded-full bg-signal">
            <span className="font-display text-[64px] font-medium">{t("pills.trip")}</span>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section id="how" className="flex flex-col gap-8 rounded-panel bg-card p-6 md:p-10">
          <SectionHead title={t("how.title")} lead={t("how.lead")} />
          <div className="grid gap-3" style={auto(300)}>
            {(["s1", "s2", "s3"] as const).map((s, i) => (
              <div
                key={s}
                className={cn(
                  "flex flex-col gap-14 rounded-[22px] p-7",
                  i === 2 ? "bg-ink text-white" : "bg-background",
                )}
              >
                <span className={cn("font-display text-[44px]", i === 2 && "text-signal")}>0{i + 1}.</span>
                <div>
                  <h3 className="font-display text-[28px]">{t(`how.${s}`)}</h3>
                  <p
                    className={cn(
                      "mt-2.5 leading-relaxed",
                      i === 2 ? "text-[#c9c9c9]" : "text-muted-foreground",
                    )}
                  >
                    {t(`how.${s}t`)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BEFORE / NOW */}
        <section className="grid gap-3" style={auto(420)}>
          <div className="flex min-h-80 flex-col gap-6 rounded-panel bg-ink-2 p-6 text-white md:p-10">
            <h3 className="font-display text-[44px]">{t("compare.before")}</h3>
            <ul className="flex list-disc flex-col gap-2.5 pl-5 leading-relaxed text-[#d6d6d6]">
              <li>{t("compare.b1")}</li>
              <li>{t("compare.b2")}</li>
              <li>{t("compare.b3")}</li>
            </ul>
          </div>
          <div className="flex min-h-80 flex-col gap-6 rounded-panel bg-blue p-6 text-white md:p-10">
            <h3 className="font-display text-[44px]">{t("compare.now")}</h3>
            <ul className="flex list-disc flex-col gap-2.5 pl-5 leading-relaxed">
              <li>{t("compare.n1")}</li>
              <li>{t("compare.n2")}</li>
              <li>{t("compare.n3")}</li>
            </ul>
          </div>
        </section>

        {/* TRIP ROOM */}
        <section id="room" className="grid gap-3" style={auto(300)}>
          <div className="col-span-full flex flex-wrap items-end justify-between gap-4 rounded-panel bg-card p-6 md:p-10">
            <div>
              <span className={tag}>{t("room.badge")}</span>
              <h2 className={cn(h2, "mt-4")}>{t("room.title")}</h2>
            </div>
            <p className="max-w-[460px] leading-relaxed text-muted-foreground">{t("room.lead")}</p>
          </div>
          <div className="flex flex-col gap-4 rounded-[22px] bg-card p-6">
            <CardHead title={t("room.chat")} n="01" />
            <div className="rounded-2xl bg-ink p-3.5 text-sm text-white">{t("room.announce")}</div>
            <div className="self-start rounded-[16px_16px_16px_4px] bg-background px-3.5 py-2.5 text-sm">
              {t("room.msg1")}
            </div>
            <div className="self-end rounded-[16px_16px_4px_16px] bg-blue px-3.5 py-2.5 text-sm text-white">
              {t("room.msg2")}
            </div>
          </div>
          <div className="flex flex-col gap-3 rounded-[22px] bg-card p-6">
            <CardHead title={t("room.plan")} n="02" />
            {(["d1", "d2", "d3"] as const).map((d, i) => (
              <div
                key={d}
                className={cn("flex items-center gap-3", i < 2 && "border-b border-background pb-2.5")}
              >
                <span className="w-10 font-display text-[22px]">{i + 1}</span>
                <div>
                  <div className="font-semibold">{t(`room.${d}`)}</div>
                  <div className="text-sm text-muted-foreground">{t(`room.${d}t`)}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-3 rounded-[22px] bg-card p-6">
            <CardHead title={t("room.costs")} n="03" />
            <div className="font-display text-5xl">$1 240</div>
            <div className="text-sm text-muted-foreground">{t("room.total")}</div>
            <div className="flex justify-between rounded-[14px] bg-background p-3 text-sm">
              <span>{t("room.owe")}</span>
              <strong>$34</strong>
            </div>
            <div className="text-xs text-muted-foreground">{t("room.costsNote")}</div>
          </div>
        </section>

        {/* TICKETS & TOURS */}
        <section id="book" className="grid gap-3" style={auto(360)}>
          <div className="flex flex-col justify-between gap-4 rounded-panel bg-card p-6 md:p-8">
            <span className="text-[13px] font-semibold tracking-[.06em] text-muted-foreground">
              {t("book.kicker")}
            </span>
            <h2 className="font-display text-[clamp(40px,5vw,64px)]">{t("book.title")}</h2>
            <p className="text-[17px] leading-relaxed text-[#3f3f3f]">{t("book.lead")}</p>
          </div>
          <div className="grid gap-3">
            <div className="flex flex-col gap-2.5 rounded-panel bg-card p-7">
              <span className="font-display text-[40px]">01</span>
              <h3 className="font-display text-3xl">{t("book.o1")}</h3>
              <p className="leading-relaxed text-muted-foreground">{t("book.o1t")}</p>
            </div>
            <div className="flex flex-col gap-2.5 rounded-panel bg-ink p-7 text-white">
              <span className="font-display text-[40px] text-signal">02</span>
              <h3 className="font-display text-3xl">{t("book.o2")}</h3>
              <p className="leading-relaxed text-[#c9c9c9]">{t("book.o2t")}</p>
            </div>
          </div>
        </section>

        {/* CLUBS */}
        <section id="clubs" className="flex flex-col gap-8 rounded-panel bg-card p-6 md:p-10">
          <SectionHead title={t("clubs.title")} lead={t("clubs.lead")} />
          <div className="grid gap-3" style={auto(260)}>
            {(["c1", "c2", "c3"] as const).map((c) => (
              <div key={c} className="flex flex-col gap-5 rounded-[22px] border border-line p-6">
                <span className={cn(tag, "self-start")}>{t("clubs.sample")}</span>
                <div className="font-display text-[26px]">{t(`clubs.${c}`)}</div>
                <div className="text-sm text-muted-foreground">{t(`clubs.${c}t`)}</div>
              </div>
            ))}
            <a
              href={start}
              className="press flex flex-col justify-between gap-5 rounded-[22px] bg-ink p-6 text-white"
            >
              <div className="font-display text-[26px]">{t("clubs.open")}</div>
              <span className="flex size-14 items-center justify-center self-end rounded-full bg-signal text-ink">
                <ArrowIcon className="size-[22px]" />
              </span>
            </a>
          </div>
        </section>

        {/* MEMORIES */}
        <section id="stories" className="flex flex-col gap-8 rounded-panel bg-ink p-6 text-white md:p-10">
          <SectionHead title={t("stories.title")} lead={t("stories.lead")} dark />
          <div className="grid gap-3" style={auto(300)}>
            {(
              [
                ["s1", "hike-group"],
                ["s2", "cappadocia"],
              ] as const
            ).map(([s, photo]) => (
              <div key={s} className="overflow-hidden rounded-[22px] bg-[#1c1c1c]">
                {/* eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP */}
                <img
                  src={`/photos/${photo}-1200.webp`}
                  alt={t(`stories.${s}alt`)}
                  loading="lazy"
                  className="h-[220px] w-full object-cover"
                />
                <div className="p-5">
                  <div className="font-display text-[22px]">{t(`stories.${s}`)}</div>
                  <div className="mt-1.5 text-sm text-[#bdbdbd]">{t(`stories.${s}t`)}</div>
                </div>
              </div>
            ))}
            <div className="flex flex-col justify-between gap-6 rounded-[22px] bg-signal p-6 text-ink">
              <div className="font-display text-3xl">{t("stories.invite")}</div>
              <div className="text-sm leading-relaxed">{t("stories.invitet")}</div>
            </div>
          </div>
        </section>

        {/* FACTS + TRUST */}
        <section className="grid gap-3" style={auto(260)}>
          {(["free", "age", "langs"] as const).map((f) => (
            <div key={f} className="flex flex-col justify-between gap-10 rounded-[22px] bg-card p-7">
              <span className="font-display text-[64px]">{t(`facts.${f}`)}</span>
              <span className="text-sm text-muted-foreground">{t(`facts.${f}t`)}</span>
            </div>
          ))}
          <div className="flex flex-col gap-3.5 rounded-[22px] bg-card p-7">
            <h3 className="font-display text-2xl">{t("facts.trust")}</h3>
            <ul className="flex flex-col gap-2 text-sm">
              {(["t1", "t2", "t3", "t4"] as const).map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <CheckIcon />
                  {t(`facts.${k}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* AGENCIES */}
        <section className="flex flex-wrap items-center justify-between gap-6 rounded-panel bg-card p-6 md:p-10">
          <div className="max-w-[640px]">
            <span className={tag}>{t("agencies.soon")}</span>
            <h2 className="mt-3.5 font-display text-[clamp(28px,3vw,40px)]">{t("agencies.title")}</h2>
          </div>
          <a href="#final" className={pill}>
            {t("agencies.cta")}
          </a>
        </section>

        {/* FINAL CTA */}
        <section
          id="final"
          className="grid items-end gap-8 rounded-panel bg-blue px-6 py-10 text-white md:px-10 md:py-12"
          style={auto(420)}
        >
          <h2 className="font-display text-[clamp(44px,6vw,88px)]">{t("final.title")}</h2>
          <WaitlistForm botUrl={start} nowLabel={t("final.now")} />
        </section>

        <footer className="flex flex-wrap justify-between gap-3 px-2 py-6 text-sm text-muted-foreground">
          <span>{t("footer.brand", { app: APP_NAME })}</span>
          <span className="flex flex-wrap gap-x-4">
            {(["terms", "privacy", "safety", "support"] as const).map((k) => (
              <Link
                key={k}
                href={`/${k}`}
                className="inline-flex min-h-11 items-center underline underline-offset-2"
              >
                {tl(`nav.${k}`)}
              </Link>
            ))}
          </span>
        </footer>
      </div>
    </div>
  );
}

function SectionHead({ title, lead, dark }: { title: string; lead: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-4 border-b pb-6",
        dark ? "border-[#333]" : "border-line",
      )}
    >
      <h2 className={h2}>{title}</h2>
      <p className={cn("max-w-[460px] leading-relaxed", dark ? "text-[#c9c9c9]" : "text-muted-foreground")}>
        {lead}
      </p>
    </div>
  );
}

function CardHead({ title, n }: { title: string; n: string }) {
  return (
    <div className="flex justify-between">
      <h3 className="font-display text-2xl">{title}</h3>
      <span className={tag}>{n}</span>
    </div>
  );
}
