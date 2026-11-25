import type { Metadata } from "next";
import { docMetadata, LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/terms">): Promise<Metadata> {
  return docMetadata("terms", (await params).locale);
}

export default function Page({ params }: PageProps<"/[locale]/terms">) {
  return <LegalPage kind="terms" params={params} />;
}
