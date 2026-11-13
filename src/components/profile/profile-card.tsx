import { BadgeCheck, Circle } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { countryName, languageName } from "@/lib/catalog";
import type { getPublicProfile } from "@/modules/profiles/service";

type P = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

export async function ProfileCard({ p }: { p: P }) {
  const [t, tc, ts, ti, locale] = await Promise.all([
    getTranslations("profile"),
    getTranslations("common"),
    getTranslations("styles"),
    getTranslations("interests"),
    getLocale(),
  ]);
  const place = [p.city, p.country && countryName(p.country, locale)].filter(Boolean).join(", ");
  const tags = (items: string[], label: (k: string) => string) =>
    items.length > 0 && (
      <ul className="flex flex-wrap gap-2">
        {items.map((k) => (
          <li key={k} className="rounded-full bg-muted px-3 py-1 text-sm">
            {label(k)}
          </li>
        ))}
      </ul>
    );

  return (
    <section className="flex flex-col gap-5 rounded-2xl border p-6">
      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          {p.displayName.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{p.displayName}</h1>
          <p className="text-muted-foreground">
            {[tc("years", { n: p.age }), p.gender && t(`genders.${p.gender}`), place]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>
      <ul className="flex flex-wrap gap-3 text-sm">
        {(["telegram", "phone", "id"] as const).map((k) => (
          <li
            key={k}
            className={`flex items-center gap-1.5 ${p.verified[k] ? "text-primary" : "text-muted-foreground"}`}
          >
            {p.verified[k] ? (
              <BadgeCheck className="size-4" aria-hidden />
            ) : (
              <Circle className="size-4" aria-hidden />
            )}
            {t(`verified.${k}`)}
            <span className="sr-only">{p.verified[k] ? "✓" : "—"}</span>
          </li>
        ))}
      </ul>
      {p.bio && <p className="whitespace-pre-line">{p.bio}</p>}
      {tags(p.languages, (l) => languageName(l, locale))}
      {tags(p.travelStyles, (s) => ts(s))}
      {tags(p.interests, (s) => ti(s))}
    </section>
  );
}
