import Script from "next/script";
import { TelegramInit } from "@/components/telegram-actions";
import { TG_SCRIPT } from "@/lib/telegram-webapp";

// Full-screen Mini App flows (Mini App entry, welcome, onboarding): no site header, phone-width column,
// Telegram's own header and MainButton/BackButton around it.
export default function FlowLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <Script src={TG_SCRIPT} strategy="afterInteractive" />
      <TelegramInit />
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-2 px-3 pt-3">{children}</main>
    </>
  );
}
