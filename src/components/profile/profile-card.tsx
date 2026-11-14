import { getLocale, getTranslations } from "next-intl/server";
import { CheckIcon, Display, Panel } from "@/components/clay";
import { languageName } from "@/lib/catalog";
import type { getPublicProfile } from "@/modules/profiles/service";

type P = NonNullable<Awaited<ReturnType<typeof getPublicProfile>>>;

const chip = "inline-flex min-h-9 items-center gap-1 rounded-full border px-3 text-[13px] font-medium";

/** Profile header (App-Profile.png): avatar, "Name, age", city · languages, verification chips. */
export async function ProfileCard({ p, actions }: { p: P; actions?: React.ReactNode }) {
  const [t, locale] = await Promise.all([getTranslations("profile"), getLocale()]);
  const where = [p.city, p.languages.map((l) => languageName(l, locale)).join(", ")]
    .filter(Boolean)
    .join(" · ");
  const ok = (label: string) => (
    <span key={label} className={`${chip} border-success/30 bg-success-soft text-success`}>
      <CheckIcon />
      {label}
    </span>
  );
  return (
    <Panel className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="flex size-[88px] flex-none items-center justify-center rounded-full bg-[#c9d4e3] text-3xl font-semibold">
          {p.displayName.slice(0, 1)}
        </span>
        <div className="min-w-0">
          <Display className="text-[32px]">
            {p.displayName}, {p.age}
          </Display>
          {where && <p className="mt-1 text-[15px] text-muted-foreground">{where}</p>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {p.verified.telegram && ok("Telegram")}
        {p.verified.phone && ok(t("verified.phone"))}
        {p.verified.id && ok(t("verified.id"))}
        {actions}
      </div>
      {p.bio && <p className="text-[15px] whitespace-pre-line">{p.bio}</p>}
    </Panel>
  );
}

export const profileChip = chip;
