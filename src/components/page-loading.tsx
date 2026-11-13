export function PageLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy>
      <div className="h-8 w-1/2 animate-pulse rounded-lg bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
      <div className="h-24 animate-pulse rounded-2xl bg-muted" />
    </div>
  );
}
