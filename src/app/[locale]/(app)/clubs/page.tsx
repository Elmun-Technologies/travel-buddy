import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Display, Panel, clayInput } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { Link } from "@/i18n/navigation";
import { asLocale, requireProfile } from "@/lib/guard";
import { listClubs } from "@/modules/clubs/service";

export default function ClubsPage(props: PageProps<"/[locale]/clubs">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Clubs {...props} />
    </Suspense>
  );
}

// Clubs: standing communities that open trips and keep their own news.
async function Clubs({ params, searchParams }: PageProps<"/[locale]/clubs">) {
  const { user } = await requireProfile(asLocale((await params).locale));
  const q = String((await searchParams).q ?? "").slice(0, 60);
  const [t, list] = await Promise.all([getTranslations("clubsUi"), listClubs(user.id, q)]);
  return (
    <div className="flex flex-col gap-2">
      <Display className="px-1 pt-2 text-[34px]">{t("title")}</Display>
      <p className="px-1 text-[15px] text-muted-foreground">{t("lead")}</p>
      <div className="flex gap-2">
        <form className="flex flex-1 gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder={t("search")}
            aria-label={t("search")}
            className={`${clayInput} rounded-full`}
          />
        </form>
        <Link
          href="/clubs/new"
          className="press inline-flex min-h-12 items-center rounded-full bg-ink px-5 font-semibold text-white"
        >
          {t("create")}
        </Link>
      </div>
      {list.length === 0 && <Panel className="text-muted-foreground">{t("none")}</Panel>}
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((c) => (
          <Link
            key={c.id}
            href={`/clubs/${c.id}`}
            className="press lift flex flex-col gap-2 rounded-panel bg-card p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="font-display text-[22px] leading-tight">{c.name}</span>
              <span className="flex-none rounded-full border border-input px-2.5 py-0.5 text-xs">
                {c.privacy === "open" ? t("open") : t("closed")}
              </span>
            </div>
            {c.description && <p className="line-clamp-2 text-sm text-muted-foreground">{c.description}</p>}
            <div className="mt-auto flex flex-wrap gap-x-3 text-xs text-muted-foreground">
              <span>{t("members", { n: c.members })}</span>
              {c.completed > 0 && <span>{t("trips", { n: c.completed })}</span>}
              {c.city && <span>{c.city}</span>}
              {c.myStatus === "approved" && <span className="font-semibold text-ink">{t("member")}</span>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
