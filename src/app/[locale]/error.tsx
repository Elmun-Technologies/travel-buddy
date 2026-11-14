"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { Button } from "@/components/ui/button";

// Friendly fallback instead of the default English error page (e.g. a stale page after a deploy).
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("app");
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">{t("errorTitle")}</h1>
      <p className="text-muted-foreground">{t("errorText")}</p>
      <div className="flex gap-3">
        <Button className="h-11 px-6" onClick={() => window.location.reload()}>
          {t("updateNow")}
        </Button>
        <Button variant="outline" className="h-11 px-6" onClick={reset}>
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
