import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
// /me kabi: authsuz foydalanuvchi /login'ga yo'naladi
// requireUser import qilingan (shartnoma: includeGhostRequester wargs)
import { Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { asLocale, requireUser } from "@/lib/guard";
import { Link } from "@/i18n/navigation";
import { getDisplayNames } from "@/modules/profiles/service";
import { unblockAction } from "../../actions";
import { blocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";

export default function BlockedPage(props: PageProps<"/[locale]/me/blocked">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Blocked {...props} />
    </Suspense>
  );
}

async function Blocked({ params }: PageProps<"/[locale]/me/blocked">) {
  const locale = asLocale((await params).locale);
  const user = await requireUser(locale); // /me kabi, /login'ga yo'naltirish
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const db = getDb();

  // Foydalanuvchi bloklagan barcha foydalanuvchilar
  const rows = await db
    .select({ blockedId: blocks.blockedId })
    .from(blocks)
    .where(eq(blocks.blockerId, user.id));

  const blockedIds: string[] = rows.map((r) => r.blockedId);
  const names = await getDisplayNames(blockedIds);

  return (
    <div className="flex flex-col gap-2">
      <h1 className="sr-only">{t("blocked.title")}</h1>
      <Panel className="flex flex-col gap-3">
        <h2 className="pb-1 text-xs font-semibold tracking-[.06em] text-muted-foreground uppercase">
          {t("blocked.title")}
        </h2>
        {blockedIds.length === 0 ? (
          <p className="text-[15px] text-muted-foreground">
            {t("blocked.empty")}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {blockedIds.map((blockedId: string) => (
              <div
                key={blockedId}
                className="flex min-h-14 items-center justify-between gap-3 border-b border-line py-3 last:border-b-0"
              >
                <span className="text-sm">{names.get(blockedId) ?? blockedId}</span>
                <form action={unblockAction}>
                  <input type="hidden" name="locale" value={locale} />
                  <input type="hidden" name="blockedId" value={blockedId} />
                  <button
                    type="submit"
                    className="min-h-11 text-[13px] font-medium text-danger hover:underline"
                  >
                    {t("blocked.unblock")}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Link href="/me" className="self-start font-medium underline">
        {tc("back")}
      </Link>
    </div>
  );
}