import { BadgeCheck, EyeOff, Flag, Plane, ShieldCheck, Users, UsersRound } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { APP_NAME } from "@/lib/config";

export default async function Landing() {
  const t = await getTranslations();
  const locale = await getLocale();

  const steps = [
    { key: "s1", icon: Users },
    { key: "s2", icon: UsersRound },
    { key: "s3", icon: Plane },
  ] as const;
  const trust = [
    { key: "t1", icon: BadgeCheck },
    { key: "t2", icon: EyeOff },
    { key: "t3", icon: ShieldCheck },
    { key: "t4", icon: Flag },
  ] as const;

  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <span className="font-semibold tracking-tight">{APP_NAME}</span>
          <nav aria-label={t("nav.language")} className="flex items-center gap-1 text-sm">
            <Link href="/trips" className="mr-2 rounded-md px-2 py-1 font-medium hover:bg-muted">
              {t("app.trips")}
            </Link>
            {routing.locales.map((l) => (
              <Link
                key={l}
                href="/"
                locale={l}
                aria-current={l === locale ? "true" : undefined}
                className="rounded-md px-2 py-1 uppercase text-muted-foreground hover:text-foreground aria-[current]:bg-muted aria-[current]:text-foreground"
              >
                {l}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-4 pt-16 pb-20 sm:pt-24">
          <p className="mb-5 inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
            {t("hero.badge")}
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-pretty text-muted-foreground">{t("hero.subtitle")}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="#waitlist" className={buttonVariants({ className: "h-11 px-5 text-base" })}>
              {t("hero.cta")}
            </a>
            <span className="text-sm text-muted-foreground">{t("hero.note")}</span>
          </div>
        </section>

        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-5xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("how.title")}</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {steps.map(({ key, icon: Icon }, i) => (
                <li key={key} className="rounded-2xl border bg-background p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="text-sm font-medium text-muted-foreground">{i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{t(`how.${key}.title`)}</h3>
                  <p className="mt-2 text-muted-foreground">{t(`how.${key}.text`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("trust.title")}</h2>
          <ul className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {trust.map(({ key, icon: Icon }) => (
              <li key={key} className="flex gap-4">
                <Icon className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="font-semibold">{t(`trust.${key}.title`)}</h3>
                  <p className="mt-1 text-muted-foreground">{t(`trust.${key}.text`)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section id="waitlist" className="scroll-mt-16 border-t bg-muted/40">
          <div className="mx-auto max-w-xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("waitlist.title")}</h2>
            <p className="mt-2 mb-8 text-muted-foreground">{t("waitlist.subtitle")}</p>
            <WaitlistForm />
          </div>
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-4 py-8 text-sm text-muted-foreground">
          {t("footer.rights", { app: APP_NAME })}
        </div>
      </footer>
    </>
  );
}
