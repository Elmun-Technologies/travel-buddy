import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <Link href="/" className="text-primary underline underline-offset-4">
        {t("back")}
      </Link>
    </main>
  );
}
