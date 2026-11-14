"use client";

import { ShoppingBag, UtensilsCrossed, Wallet } from "lucide-react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "@/components/clay";
import { TRAVEL_STYLES } from "@/lib/catalog";
import { cn } from "@/lib/utils";

type Style = (typeof TRAVEL_STYLES)[number];

// Licensed photos (public/photos, see CREDITS.md); styles without a fitting photo get a line icon.
const PHOTO: Partial<Record<Style, string>> = {
  mountains: "kazbek",
  beach: "batumi",
  city: "tbilisi-city",
  photo: "cappadocia",
  extreme: "summit-group",
};
const ICON = { food: UtensilsCrossed, budget: Wallet, shopping: ShoppingBag } as const;

/** Travel styles as 2-column cards: picture, name, one line of what it means in practice. */
export function StyleCards({ selected, onToggle }: { selected: string[]; onToggle: (s: Style) => void }) {
  const ts = useTranslations("styles");
  const td = useTranslations("styleHints");
  return (
    <div className="grid grid-cols-2 gap-2">
      {TRAVEL_STYLES.map((s) => {
        const on = selected.includes(s);
        const Icon = ICON[s as keyof typeof ICON];
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(s)}
            className={cn(
              "press relative flex flex-col overflow-hidden rounded-card border-2 bg-card text-left transition-colors",
              on ? "border-ink" : "border-transparent",
            )}
          >
            {PHOTO[s] ? (
              // eslint-disable-next-line @next/next/no-img-element -- pre-compressed WebP, no runtime resizing
              <img src={`/photos/${PHOTO[s]}-400.webp`} alt="" className="h-20 w-full object-cover" />
            ) : (
              <span className="flex h-20 w-full items-center justify-center bg-background">
                {Icon && <Icon className="size-7" strokeWidth={1.5} aria-hidden="true" />}
              </span>
            )}
            {on && (
              <span className="absolute top-2 right-2 flex size-6 items-center justify-center rounded-full bg-ink text-white">
                <CheckIcon />
              </span>
            )}
            <span className="flex flex-col gap-0.5 p-3">
              <span className="text-sm font-semibold">{ts(s)}</span>
              <span className="text-xs leading-snug text-muted-foreground">{td(s)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
