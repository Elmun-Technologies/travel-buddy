import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { APP_NAME, legalInfo } from "@/lib/config";
import { asLocale } from "@/lib/guard";

export type DocKind = "terms" | "privacy" | "safety" | "support";
type Section = { h: string; p: string[] };

const fill = (s: string) => s.replaceAll("{app}", APP_NAME);

/** Title, description and per-language alternates for one document page. */
export async function docMetadata(kind: DocKind, localeRaw: string): Promise<Metadata> {
  const locale = asLocale(localeRaw);
  const t = await getTranslations({ locale, namespace: "legal" });
  return {
    title: t(`${kind}.title`),
    description: fill(t(`${kind}.description`)),
    alternates: {
      canonical: `/${locale}/${kind}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}/${kind}`])),
    },
  };
}

/** Top row shared by every document: back to the app, and the four documents. */
export async function DocNav({ current }: { current: DocKind }) {
  const t = await getTranslations("legal");
  const kinds: DocKind[] = ["terms", "privacy", "safety", "support"];
  return (
    <nav aria-label={t("nav.label")} className="flex flex-wrap gap-2">
      {kinds.map((k) => (
        <Link
          key={k}
          href={`/${k}`}
          aria-current={k === current ? "page" : undefined}
          className={
            k === current
              ? "inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-medium text-white"
              : "inline-flex min-h-11 items-center rounded-full bg-card px-4 text-sm font-medium"
          }
        >
          {t(`nav.${k}`)}
        </Link>
      ))}
    </nav>
  );
}

function Sections({ items }: { items: Section[] }) {
  return (
    <>
      {items.map((s, i) => (
        <Panel key={s.h} className="flex flex-col gap-3">
          <h2 className="font-display text-2xl">
            <span className="mr-2 text-muted-foreground">{String(i + 1).padStart(2, "0")}.</span>
            {fill(s.h)}
          </h2>
          {s.p.map((p) => (
            <p key={p} className="text-[15px] leading-relaxed">
              {fill(p)}
            </p>
          ))}
        </Panel>
      ))}
    </>
  );
}

async function Operator() {
  await connection(); // operator details are runtime env
  const t = await getTranslations("legal");
  const info = legalInfo();
  if (!info.entity && !info.address && !info.email && !info.telegram) return null;
  return (
    <Panel className="flex flex-col gap-2 text-[15px]">
      {info.entity && (
        <p>
          <span className="text-muted-foreground">{t("operator")}: </span>
          {info.entity}
          {info.address ? `, ${info.address}` : ""}
        </p>
      )}
      {info.email && (
        <p>
          <span className="text-muted-foreground">{t("contactEmail")}: </span>
          <a className="underline" href={`mailto:${info.email}`}>
            {info.email}
          </a>
        </p>
      )}
      {info.telegram && (
        <p>
          <a className="underline" href={`https://t.me/${info.telegram}`}>
            {t("contactTelegram")} (@{info.telegram})
          </a>
        </p>
      )}
    </Panel>
  );
}

async function Doc({ kind, localeRaw }: { kind: Exclude<DocKind, "support">; localeRaw: string }) {
  const locale = asLocale(localeRaw);
  const t = await getTranslations({ locale, namespace: "legal" });
  const sections = t.raw(`${kind}.sections`) as Section[];
  return (
    <>
      <DocNav current={kind} />
      <header className="flex flex-col gap-3 px-1 py-4">
        <Display className="text-[clamp(36px,8vw,56px)] leading-[1.02]">{t(`${kind}.title`)}</Display>
        <p className="text-[17px] leading-relaxed text-muted-foreground">{fill(t(`${kind}.lead`))}</p>
        <p className="text-sm text-muted-foreground">{t("updated")}</p>
      </header>
      <Sections items={sections} />
      {kind === "terms" || kind === "privacy" ? <Operator /> : null}
      <Link href="/" className="inline-flex min-h-11 items-center self-start px-1 font-medium underline">
        {t("back")}
      </Link>
    </>
  );
}

/** Terms, privacy and safety share one layout. */
export function LegalPage({
  kind,
  params,
}: {
  kind: Exclude<DocKind, "support">;
  params: Promise<{ locale: string }>;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Resolved kind={kind} params={params} />
    </Suspense>
  );
}

async function Resolved({
  kind,
  params,
}: {
  kind: Exclude<DocKind, "support">;
  params: Promise<{ locale: string }>;
}) {
  return <Doc kind={kind} localeRaw={(await params).locale} />;
}
