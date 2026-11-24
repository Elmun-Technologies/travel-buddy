import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

const link = "inline-flex min-h-11 items-center underline underline-offset-2";

/** Row of the four public documents (profile page, landing footer). */
export async function LegalLinks({ className }: { className?: string }) {
  const t = await getTranslations("legal.nav");
  return (
    <nav aria-label={t("label")} className={className ?? "flex flex-wrap gap-x-4 text-sm text-muted-foreground"}>
      {(["terms", "privacy", "safety", "support"] as const).map((k) => (
        <Link key={k} href={`/${k}`} className={link}>
          {t(k)}
        </Link>
      ))}
    </nav>
  );
}

/** "By continuing you accept the Terms and the Privacy policy" with live links (login page). */
export async function AcceptLine() {
  const [t, n] = await Promise.all([getTranslations("legal"), getTranslations("legal.nav")]);
  const [before, rest] = t("accept", { terms: "\u0000", privacy: "\u0001" }).split("\u0000");
  const [between, after] = rest.split("\u0001");
  return (
    <p className="text-sm text-muted-foreground">
      {before}
      <Link href="/terms" className="underline underline-offset-2">
        {n("terms")}
      </Link>
      {between}
      <Link href="/privacy" className="underline underline-offset-2">
        {n("privacy")}
      </Link>
      {after}
    </p>
  );
}
