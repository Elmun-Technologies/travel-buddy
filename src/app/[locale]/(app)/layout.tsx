import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { APP_NAME } from "@/lib/config";
import { asLocale } from "@/lib/guard";
import { getSessionUser } from "@/lib/session";
import { logoutAction } from "./actions";

export default async function AppLayout({ children, params }: LayoutProps<"/[locale]">) {
  const t = await getTranslations("app");
  return (
    <>
      <header className="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/trips" className="font-semibold tracking-tight">
            {APP_NAME}
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link href="/trips" className="rounded-md px-2 py-1.5 hover:bg-muted">
              {t("trips")}
            </Link>
            <Suspense fallback={<span className="w-16" />}>
              <UserNav params={params} />
            </Suspense>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-10">{children}</main>
    </>
  );
}

async function UserNav({ params }: { params: LayoutProps<"/[locale]">["params"] }) {
  const locale = asLocale((await params).locale);
  const [t, user] = await Promise.all([getTranslations("app"), getSessionUser()]);
  if (!user)
    return (
      <Link href="/login" className={buttonVariants({ size: "sm" })}>
        {t("login")}
      </Link>
    );
  return (
    <>
      <Link href="/trips/new" className={buttonVariants({ size: "sm" })}>
        + <span className="hidden sm:inline">{t("newTrip")}</span>
      </Link>
      <Link href="/me" className="rounded-md px-2 py-1.5 hover:bg-muted">
        {t("profile")}
      </Link>
      <form action={logoutAction} className="hidden sm:block">
        <input type="hidden" name="locale" value={locale} />
        <button className="rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted">{t("logout")}</button>
      </form>
    </>
  );
}
