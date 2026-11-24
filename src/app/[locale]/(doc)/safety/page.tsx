import type { Metadata } from "next";
import { docMetadata, LegalPage } from "@/components/legal/legal-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/safety">): Promise<Metadata> {
  return docMetadata("safety", (await params).locale);
}

export default function Page({ params }: PageProps<"/[locale]/safety">) {
  return <LegalPage kind="safety" params={params} />;
}
