import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageLoading } from "@/components/page-loading";
import { Link } from "@/i18n/navigation";
import { APP_NAME } from "@/lib/config";
import { requireAdmin } from "@/lib/guard";

export const metadata: Metadata = { robots: { index: false, follow: false } };

const NAV = [
  "",
  "reports",
  "users",
  "ids",
  "clubs",
  "agencies",
  "trips",
  "requests",
  "visa",
  "prices",
  "creator",
  "audit",
] as const;

// Internal panel for the team (ADMIN_TELEGRAM_IDS). Desktop-first, works on a phone too.
export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}

async function Shell({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const t = await getTranslations("admin");
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-4 px-3 py-4 md:flex-row md:px-6">
      <nav className="flex gap-1 overflow-x-auto md:w-52 md:flex-none md:flex-col" aria-label={t("nav")}>
        <span className="hidden px-3 pb-3 text-lg font-semibold md:block">
          {APP_NAME} · {t("title")}
        </span>
        {NAV.map((k) => (
          <Link
            key={k}
            href={`/admin${k ? `/${k}` : ""}`}
            className="flex min-h-11 flex-none items-center rounded-full px-4 text-[15px] whitespace-nowrap hover:bg-card"
          >
            {t(`nav_${k || "home"}`)}
          </Link>
        ))}
      </nav>
      <main className="flex min-w-0 flex-1 flex-col gap-3">{children}</main>
    </div>
  );
}
