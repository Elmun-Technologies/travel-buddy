import { Suspense } from "react";
import { AppNav, AppNavView } from "@/components/app-nav";
import { APP_NAME } from "@/lib/config";

// Inside the app: tab bar (bottom on phones, top on desktop), grey canvas, bento panels.
export default function AppLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <Suspense fallback={<AppNavView brand={APP_NAME} path="" />}>
        <AppNav brand={APP_NAME} />
      </Suspense>
      <main className="mx-auto w-full max-w-[880px] flex-1 px-3 pt-3 pb-28 md:px-4 md:pt-6 md:pb-10">
        {children}
      </main>
    </>
  );
}
