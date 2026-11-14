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
      <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col px-3 pt-3 pb-28 [--main-action-bottom:calc(64px+max(0.75rem,env(safe-area-inset-bottom)))] md:px-4 md:pt-6 md:pb-10 md:[--main-action-bottom:0px]">
        {children}
      </main>
    </>
  );
}
