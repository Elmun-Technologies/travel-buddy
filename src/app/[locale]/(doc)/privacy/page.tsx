import type { Metadata } from "next";
import { docMetadata, LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/privacy">): Promise<Metadata> {
  return docMetadata("privacy", (await params).locale);
}

export default function Page({ params }: PageProps<"/[locale]/privacy">) {
  return <LegalPage kind="privacy" params={params} />;
}
