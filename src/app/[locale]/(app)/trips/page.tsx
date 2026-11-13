import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { inputClass } from "@/components/form";
import { PageLoading } from "@/components/page-loading";
import { TripCard } from "@/components/trips/trip-card";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { COUNTRIES, countryName, todayISO, TRAVEL_STYLES } from "@/lib/catalog";
import { asLocale } from "@/lib/guard";
import { getSessionUser } from "@/lib/session";
import { feedFilterSchema } from "@/modules/trips/schema";
import { listFeed } from "@/modules/trips/service";

export default function FeedPage(props: PageProps<"/[locale]/trips">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Feed {...props} />
    </Suspense>
  );
}

function nextMonths(n: number, locale: string) {
  const [y, m] = todayISO().split("-").map(Number);
  const f = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return { value: d.toISOString().slice(0, 7), label: f.format(d) };
  });
}

// Public: anyone can browse; blocked owners are hidden for logged-in viewers.
async function Feed({ params, searchParams }: PageProps<"/[locale]/trips">) {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const filter = feedFilterSchema.parse(sp);
  const user = await getSessionUser();
  const [{ items, hasMore }, t, tc, ts] = await Promise.all([
    listFeed(user?.id ?? null, filter),
    getTranslations("feed"),
    getTranslations("common"),
    getTranslations("styles"),
  ]);
  const query = (page: number) => ({
    ...Object.fromEntries(Object.entries(filter).filter(([, v]) => v)),
    page,
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Plain GET form: filters live in the URL, shareable, no JS needed */}
      <form className="grid grid-cols-2 gap-3 rounded-2xl border p-4 sm:grid-cols-5 sm:items-end">
        <label className="flex flex-col gap-1 text-sm">
          {t("country")}
          <select name="country" defaultValue={filter.country ?? ""} className={inputClass}>
            <option value="">{tc("any")}</option>
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {countryName(c, locale)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("month")}
          <select name="month" defaultValue={filter.month ?? ""} className={inputClass}>
            <option value="">{tc("any")}</option>
            {nextMonths(12, locale).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("budget")}
          <input
            name="budget"
            type="number"
            min={1}
            inputMode="numeric"
            defaultValue={filter.budget ?? ""}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t("style")}
          <select name="style" defaultValue={filter.style ?? ""} className={inputClass}>
            <option value="">{tc("any")}</option>
            {TRAVEL_STYLES.map((s) => (
              <option key={s} value={s}>
                {ts(s)}
              </option>
            ))}
          </select>
        </label>
        <div className="col-span-2 flex gap-2 sm:col-span-1">
          <button className={buttonVariants({ className: "h-11 flex-1" })}>{t("apply")}</button>
          <Link href="/trips" className={buttonVariants({ variant: "ghost", className: "h-11" })}>
            {t("reset")}
          </Link>
        </div>
      </form>

      {items.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{t("empty")}</p>
      )}

      <nav className="flex justify-between">
        {filter.page > 1 ? (
          <Link
            href={{ pathname: "/trips", query: query(filter.page - 1) }}
            className={buttonVariants({ variant: "outline" })}
          >
            ← {t("prev")}
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link
            href={{ pathname: "/trips", query: query(filter.page + 1) }}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("next")} →
          </Link>
        )}
      </nav>
    </div>
  );
}
