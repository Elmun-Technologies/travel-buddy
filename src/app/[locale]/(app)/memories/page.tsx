import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";

export default async function MemoriesPage() {
  const t = await getTranslations("memories");
  return <EmptyState title={t("title")} text={t("soon")} action={t("action")} href="/trips" />;
}
