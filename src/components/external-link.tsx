"use client";

import type { ComponentProps } from "react";
import { openExternal, tg } from "@/lib/telegram-webapp";

/** <a> for t.me / external URLs: inside the Mini App opens via Telegram's API (plain links are ignored there). */
export function ExternalLink({ href, onClick, ...p }: ComponentProps<"a"> & { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => {
        onClick?.(e);
        if (tg()) {
          e.preventDefault();
          openExternal(href);
        }
      }}
      {...p}
    />
  );
}
