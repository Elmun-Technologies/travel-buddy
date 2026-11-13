import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { TelegramLoginButton } from "@/components/auth/telegram-login-button";
import { PageLoading } from "@/components/page-loading";
import { buttonVariants } from "@/components/ui/button";
import { botUsername } from "@/lib/format";
import { asLocale } from "@/lib/guard";

export default function LoginPage(props: PageProps<"/[locale]/login">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Login {...props} />
    </Suspense>
  );
}

async function Login({ params, searchParams }: PageProps<"/[locale]/login">) {
  await connection(); // bot name / APP_URL are runtime env
  const locale = asLocale((await params).locale);
  const error = (await searchParams).error;
  const t = await getTranslations("auth");
  const bot = botUsername();
  const authUrl = `${process.env.APP_URL ?? ""}/api/auth/telegram/callback?locale=${locale}`;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 py-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
      </div>
      {(error === "failed" || error === "suspended") && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {t(error)}
        </p>
      )}
      {bot ? (
        <>
          <TelegramLoginButton bot={bot} authUrl={authUrl} />
          <div className="border-t pt-6">
            <p className="mb-3 text-sm text-muted-foreground">{t("orBot")}</p>
            <a
              href={`https://t.me/${bot}`}
              className={buttonVariants({ variant: "outline", className: "h-11 px-4" })}
            >
              {t("openBot")} @{bot}
            </a>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">{t("notConfigured")}</p>
      )}
    </div>
  );
}
