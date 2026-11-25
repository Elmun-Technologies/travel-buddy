"use client";

import { Compass, House, MessageCircle, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/home", key: "home", Icon: House },
  { href: "/trips", key: "trips", Icon: Compass },
  { href: "/rooms", key: "rooms", Icon: MessageCircle },
  { href: "/me", key: "profile", Icon: User },
] as const;

/** App tabs (App-Home.png): bottom bar on phones, a top bar from md up. */
export function AppNav({ brand }: { brand: string }) {
  return <AppNavView brand={brand} path={usePathname()} />;
}

/** Same bar without the active tab: the static fallback while the pathname is not known yet. */
export function AppNavView({ brand, path }: { brand: string; path: string }) {
  const t = useTranslations("nav");
  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e3e3e3] bg-card pb-[max(0.75rem,env(safe-area-inset-bottom))] md:sticky md:top-0 md:bottom-auto md:border-t-0 md:border-b md:pb-0"
    >
      <div className="mx-auto flex max-w-[880px] items-center justify-around md:justify-between md:px-4 md:py-2">
        <span className="hidden font-display text-xl font-medium md:block">{brand}</span>
        <div className="flex w-full justify-around md:w-auto md:gap-2">
          {TABS.map(({ href, key, Icon }) => {
            const active = path === href || path.startsWith(`${href}/`);
            return (
              <Link
                key={key}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-14 flex-col items-center justify-center gap-0.5 pt-2 text-[11px] font-medium md:flex-row md:gap-1.5 md:rounded-full md:px-3 md:pt-0 md:text-sm",
                  active ? "text-ink md:bg-background" : "text-muted-foreground",
                )}
              >
                <Icon className="size-[22px] md:size-[18px]" strokeWidth={1.8} aria-hidden="true" />
                {t(key)}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
