import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Display, Panel } from "@/components/clay";
import { PageLoading } from "@/components/page-loading";
import { asLocale, requireProfile } from "@/lib/guard";
import { storageEnabled } from "@/lib/storage";
import { myIdStatus } from "@/modules/verification/service";
import { VerifyForm } from "./form";

export default function VerifyPage(props: PageProps<"/[locale]/profile/verify">) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Verify {...props} />
    </Suspense>
  );
}

async function Verify({ params }: PageProps<"/[locale]/profile/verify">) {
  const { user } = await requireProfile(asLocale((await params).locale));
  const [t, status] = await Promise.all([getTranslations("verifyId"), myIdStatus(user.id)]);
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2">
      <Display className="px-1 py-2 text-[34px]">{t("title")}</Display>
      <p className="px-1 text-[15px] text-muted-foreground">{t("lead")}</p>
      {status === "approved" ? (
        <Panel tone="soft">{t("approved")}</Panel>
      ) : !storageEnabled() ? (
        <Panel>{t("off")}</Panel>
      ) : (
        <>
          {status === "pending" && <Panel tone="soft">{t("pending")}</Panel>}
          {status === "rejected" && <Panel className="text-danger">{t("rejected")}</Panel>}
          <VerifyForm retry={status === "pending" || status === "rejected"} />
        </>
      )}
      <p className="px-1 text-[13px] text-muted-foreground">{t("privacy")}</p>
    </div>
  );
}
