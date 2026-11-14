"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

/** UZ · RU · EN pills. Telegram may open the app in Russian; this lets people switch right away. */
export function LocaleSwitch({ beforeSwitch }: { beforeSwitch?: () => Promise<unknown> | void }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div role="group" aria-label="Language" className="flex gap-1 self-end rounded-full bg-card p-1">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={l === locale}
          lang={l}
          onClick={async () => {
            if (l === locale) return;
            await beforeSwitch?.();
            router.replace(`${pathname}${window.location.search}`, { locale: l });
          }}
          className={cn(
            "min-h-11 min-w-11 rounded-full px-3 text-xs font-semibold uppercase",
            l === locale ? "bg-ink text-white" : "text-muted-foreground",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
