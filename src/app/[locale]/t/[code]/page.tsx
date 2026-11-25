import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { asLocale } from "@/lib/guard";
import { tripShare } from "@/lib/trip-share";
import { getTripIdByCode } from "@/modules/trips/service";

// Short web link for sharing outside Telegram: /{locale}/t/<code> → the trip page.
// Link-preview bots do not follow our client redirect, so this page carries the trip's own
// title and picture in its metadata.
export async function generateMetadata({ params }: PageProps<"/[locale]/t/[code]">): Promise<Metadata> {
  await connection(); // APP_URL is a runtime value
  const { locale: l, code } = await params;
  const locale = asLocale(l);
  const id = await getTripIdByCode(code.toUpperCase());
  const s = id ? await tripShare(id, locale) : null;
  if (!id || !s) return { robots: { index: false } };
  const base = process.env.APP_URL;
  const image = {
    url: `/api/trips/${id}/story?kind=og&locale=${locale}`,
    width: 1200,
    height: 630,
    alt: s.trip.title,
  };
  return {
    ...(base ? { metadataBase: new URL(base) } : {}),
    title: s.trip.title,
    description: s.card.meta,
    openGraph: { title: s.trip.title, description: s.card.meta, images: [image], type: "website" },
    twitter: {
      card: "summary_large_image",
      title: s.trip.title,
      description: s.card.meta,
      images: [image.url],
    },
  };
}

export default function ShortTripLink(props: PageProps<"/[locale]/t/[code]">) {
  return (
    <Suspense>
      <Go {...props} />
    </Suspense>
  );
}

async function Go({ params }: PageProps<"/[locale]/t/[code]">) {
  const { locale, code } = await params;
  const id = await getTripIdByCode(code.toUpperCase());
  if (!id) notFound();
  redirect({ href: `/trips/${id}`, locale: asLocale(locale) });
  return null;
}
