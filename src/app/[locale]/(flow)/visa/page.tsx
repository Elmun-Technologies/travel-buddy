import { Suspense } from "react";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { ExternalLink } from "@/components/external-link";
import { PageLoading } from "@/components/page-loading";
import { BackTo } from "@/components/telegram-actions";
import { Link } from "@/i18n/navigation";
import { countryName } from "@/lib/catalog";
import { formatDay } from "@/lib/format";
import { asLocale } from "@/lib/guard";
import { countryPhoto } from "@/lib/photos";
import { cn } from "@/lib/utils";
import { listVisaAgencies, listVisaRules, type VisaRule } from "@/modules/destinations/service";

export default function VisaPage(props: PageProps<"/[locale]/visa">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Visa {...props} />
    </Suspense>
  );
}

const STATUS = {
  visa_free: "bg-success-soft text-success",
  evisa: "bg-blue-soft text-blue-ink",
  visa_required: "bg-[#fdecec] text-danger",
} as const;
const chip = "press flex min-h-11 items-center rounded-full px-5 text-[15px] font-medium";

// App-Visa: Uzbekistan passport. Data is entered in admin with a "checked on" date; never guessed.
async function Visa({ params, searchParams }: PageProps<"/[locale]/visa">) {
  const locale = asLocale((await params).locale);
  const sp = await searchParams;
  const filter = sp.f === "free" || sp.f === "required" ? sp.f : null;
  const open = typeof sp.c === "string" ? sp.c : null;
  const [all, t] = await Promise.all([listVisaRules(), getTranslations("visa")]);
  const rules = all.filter((r) =>
    filter === "free" ? r.status === "visa_free" : filter === "required" ? r.status !== "visa_free" : true,
  );
  const checked = all.reduce<string | null>((m, r) => (!m || r.checkedAt > m ? r.checkedAt : m), null);

  return (
    <>
      <BackTo label={t("back")} href="/home" />
      <div className="text-center">
        <h1 className="font-semibold">{t("title")}</h1>
        <div className="text-xs text-muted-foreground">{t("passport")}</div>
      </div>
      <Display as="h2" className="px-1 pt-2 text-[44px] leading-[1.02]">
        {t("headline")}
      </Display>
      <nav className="flex gap-2 pb-1" aria-label={t("filter")}>
        {([null, "free", "required"] as const).map((k) => (
          <Link
            key={k ?? "all"}
            href={k ? `/visa?f=${k}` : "/visa"}
            aria-current={filter === k ? "page" : undefined}
            className={cn(chip, filter === k ? "bg-ink text-white" : "border border-input bg-card")}
          >
            {t(k ? `f_${k}` : "f_all")}
          </Link>
        ))}
      </nav>

      {rules.length === 0 && <Panel className="text-muted-foreground">{t("empty")}</Panel>}
      {rules.map((r) => (
        <VisaCard key={r.id} r={r} open={open === r.destination} locale={locale} />
      ))}

      {checked && (
        <p className="px-2 pt-2 pb-6 text-[15px] text-muted-foreground">
          {t("checked", { date: formatDay(checked, locale) })}
        </p>
      )}
    </>
  );
}

async function VisaCard({ r, open, locale }: { r: VisaRule; open: boolean; locale: string }) {
  const t = await getTranslations("visa");
  const name = countryName(r.destination, locale);
  const summary = [
    r.status === "evisa" ? t("evisa") : null,
    r.visaName,
    r.maxStayDays ? t("upTo", { n: r.maxStayDays }) : null,
    r.notes,
  ]
    .filter(Boolean)
    .join(" · ");
  const head = (
    <>
      <Image
        src={countryPhoto(r.destination, 400)}
        alt=""
        width={64}
        height={64}
        className="size-16 flex-none rounded-[16px] object-cover"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-xl font-semibold">{name}</span>
        <span className="text-[15px] text-muted-foreground">{summary}</span>
        {r.isSample && (
          <span className="mt-1 self-start rounded-full bg-signal px-2 py-0.5 text-xs font-semibold">
            {t("sample")}
          </span>
        )}
      </span>
      <span
        className={cn(
          "flex-none rounded-full px-3 py-1.5 text-[15px] font-semibold",
          STATUS[r.status as keyof typeof STATUS],
        )}
      >
        {t(`s_${r.status}` as "s_visa_free")}
      </span>
    </>
  );
  if (!open)
    return (
      <Link
        href={`/visa?c=${r.destination}`}
        id={r.destination}
        className="press lift flex items-center gap-4 rounded-panel bg-card p-4"
      >
        {head}
      </Link>
    );

  const agencies = r.status === "visa_free" ? [] : await listVisaAgencies(r.destination);
  return (
    <Panel id={r.destination} className="flex flex-col gap-4 border-2 border-ink">
      <div className="flex items-center gap-4">{head}</div>
      {r.documents.length > 0 && (
        <div className="flex flex-col">
          <h3 className="pb-1 text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase">
            {t("documents")}
          </h3>
          {r.documents.map((d) => (
            <label key={d} className="flex min-h-14 cursor-pointer items-center gap-4 border-b border-line">
              <input type="checkbox" className="size-6 flex-none accent-ink" />
              <span className="text-[17px]">{d}</span>
            </label>
          ))}
        </div>
      )}
      {agencies.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase">
            {t("agencies")}
          </h3>
          {agencies.map((a) => {
            const body = (
              <>
                <span className="flex size-12 flex-none items-center justify-center rounded-xl bg-card font-semibold">
                  {a.name.slice(0, 1)}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{a.name}</span>
                  <span className="text-sm text-muted-foreground">
                    {[a.rating != null && `★ ${a.rating.toFixed(1)}`, a.note, a.isSample && t("sample")]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {a.priceMinor != null && (
                  <span className="text-xl font-semibold">${Math.round(a.priceMinor / 100)}</span>
                )}
              </>
            );
            return a.contactUrl ? (
              <ExternalLink
                key={a.id}
                href={a.contactUrl}
                className="flex min-h-[72px] items-center gap-3 rounded-[18px] bg-background px-3"
              >
                {body}
              </ExternalLink>
            ) : (
              <div
                key={a.id}
                className="flex min-h-[72px] items-center gap-3 rounded-[18px] bg-background px-3"
              >
                {body}
              </div>
            );
          })}
          <p className="text-center text-sm text-muted-foreground">{t("agencyNote")}</p>
        </div>
      )}
      {r.sourceUrl && (
        <ExternalLink href={r.sourceUrl} className="min-h-11 self-start py-2 text-sm underline">
          {t("source")}
        </ExternalLink>
      )}
    </Panel>
  );
}
