// Full-screen Mini App flows (Mini App entry, welcome, onboarding): no site header, phone-width column,
// Telegram's own header and MainButton/BackButton around it.
export default function FlowLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col gap-2 px-3 pt-3">{children}</main>
    </>
  );
}
