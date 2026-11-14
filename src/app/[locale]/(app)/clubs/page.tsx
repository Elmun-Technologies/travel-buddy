import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";

export default async function ClubsPage() {
  const t = await getTranslations("clubs");
  return <EmptyState title={t("title")} text={t("soon")} action={t("action")} href="/trips" />;
}
