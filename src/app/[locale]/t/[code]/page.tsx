import { Suspense } from "react";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { asLocale } from "@/lib/guard";
import { getTripIdByCode } from "@/modules/trips/service";

// Short web link for sharing outside Telegram: /{locale}/t/<code> → the trip page (with its OG image).
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
