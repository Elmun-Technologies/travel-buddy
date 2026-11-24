// Public documents (terms, privacy, safety, help): readable column, no app navigation.
export default function DocLayout({ children }: LayoutProps<"/[locale]">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[720px] flex-col gap-3 px-3 py-4 md:py-8">
      {children}
    </main>
  );
}
