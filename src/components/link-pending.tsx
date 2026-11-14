"use client";

import { useLinkStatus } from "next/link";

/** Inside a <Link>: dims the card and shows a spinner the moment it's tapped (navigation pending). */
export function LinkPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
      <span className="size-8 animate-spin rounded-full border-[3px] border-ink border-t-transparent" />
    </span>
  );
}
