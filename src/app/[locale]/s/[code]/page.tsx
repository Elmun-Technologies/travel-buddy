import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { Link } from "@/i18n/navigation";
import { APP_NAME } from "@/lib/config";
import { countryName } from "@/lib/catalog";
import { formatDateRange } from "@/lib/format";
import { asLocale } from "@/lib/guard";
import { publicStory } from "@/modules/memories/service";

// Public "hikoya": the photos and words of a finished trip, only while EVERY member agreed.
// Not indexed by search engines; it is meant for sharing a link.
export async function generateMetadata({ params }: PageProps<"/[locale]/s/[code]">): Promise<Metadata> {
  await connection();
  const { locale: l, code } = await params;
  const s = await publicStory(code.toUpperCase());
  if (!s) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale: asLocale(l), namespace: "story" });
  const title = t("metaTitle", { place: s.city ?? countryName(s.country, asLocale(l)) });
  const base = process.env.APP_URL;
  const image = s.photos[0] ? `/api/media/story/${s.photos[0].id}` : undefined;
  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title,
    robots: { index: false, follow: false },
    openGraph: { title, type: "article", ...(image ? { images: [{ url: image }] } : {}) },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default function StoryPage(props: PageProps<"/[locale]/s/[code]">) {
  return (
    <Suspense>
      <StoryView {...props} />
    </Suspense>
  );
}

async function StoryView({ params }: PageProps<"/[locale]/s/[code]">) {
  const { locale: l, code } = await params;
  const locale = asLocale(l);
  const s = await publicStory(code.toUpperCase());
  if (!s) notFound();
  const t = await getTranslations({ locale, namespace: "story" });
  const place = s.city ? `${s.city}, ${countryName(s.country, locale)}` : countryName(s.country, locale);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-3 px-3 py-4 md:py-8">
      <p className="px-1 text-sm font-medium text-muted-foreground">{APP_NAME}</p>
      <Display className="px-1 text-[36px]">{place}</Display>
      <p className="px-1 text-[15px] text-muted-foreground">
        {formatDateRange(s.start, s.end, locale)} · {t("people", { names: s.people.join(", ") })}
      </p>
      {s.photos.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {s.photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element -- compressed WebP, served only while everyone consents
            <img
              key={p.id}
              src={`/api/media/story/${p.id}`}
              alt={t("photoAlt", { place })}
              loading="lazy"
              className="aspect-square w-full rounded-[18px] bg-card object-cover"
            />
          ))}
        </div>
      )}
      {s.stories.map((x) => (
        <Panel key={x.name} className="flex flex-col gap-1">
          <div className="text-sm font-semibold">{x.name}</div>
          <p className="text-[15px] whitespace-pre-wrap">{x.body}</p>
        </Panel>
      ))}
      <Panel tone="dark" className="flex flex-col gap-3">
        <p className="text-lg font-semibold">{t("ctaTitle")}</p>
        <Link
          href="/"
          className="press flex min-h-[52px] items-center justify-center rounded-button bg-white px-4 font-semibold text-ink"
        >
          {t("cta")}
        </Link>
      </Panel>
      <p className="px-1 text-xs text-muted-foreground">{t("consentNote")}</p>
    </main>
  );
}
