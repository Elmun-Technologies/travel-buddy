import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import Script from "next/script";
import { SoundRoot } from "@/components/sound";
import { TelegramInit } from "@/components/telegram-actions";
import { AnalyticsBeacon } from "@/components/analytics-beacon";
import { UpdateBanner } from "@/components/update-banner";
import { TG_SCRIPT } from "@/lib/telegram-webapp";
import { APP_NAME } from "@/lib/config";
import "../globals.css";

// Both cover Latin (uz) and Cyrillic (ru). Inter Tight: headings 400–500; Inter: body.
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext", "cyrillic"] });
const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  weight: ["400", "500"],
  subsets: ["latin", "latin-ext", "cyrillic"],
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title", { app: APP_NAME }),
    description: t("description"),
    // Absolute base for canonical/alternate links. Baked at build (APP_URL build arg), like APP_NAME.
    ...(process.env.APP_URL ? { metadataBase: new URL(process.env.APP_URL) } : {}),
    openGraph: { title: t("title", { app: APP_NAME }), description: t("description"), locale },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return (
    // data-build: the build this page came from (read by UpdateBanner). Next's own data-dpl-id is
    // dropped on hydration, so we render ours through React.
    <html
      lang={locale}
      data-build={process.env.NEXT_DEPLOYMENT_ID}
      className={`${inter.variable} ${interTight.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {/* Every page may run inside the Mini App (links, buttons, version check need the API). */}
        <Script src={TG_SCRIPT} strategy="afterInteractive" />
        <NextIntlClientProvider>
          {children}
          <UpdateBanner />
          <TelegramInit />
          <SoundRoot />
          <Suspense fallback={null}>
            <AnalyticsBeacon />
          </Suspense>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
