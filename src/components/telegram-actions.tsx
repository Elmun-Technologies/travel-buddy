"use client";

import { useEffect, useRef } from "react";
import { BigButton, bigButtonClass } from "@/components/clay";
import { Link, useRouter } from "@/i18n/navigation";
import { useTelegramChrome } from "@/lib/telegram-webapp";

/**
 * The screen's one main action. Inside Telegram: the native MainButton (bottom, safe-area aware).
 * On the web: a sticky bottom button with the same look. With `href` it is a real link, so it works
 * even before hydration (a tap on a slow phone is never lost).
 */
export function MainAction({
  label,
  onClick,
  href,
  disabled,
  loading,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  const app = useTelegramChrome();
  const router = useRouter();
  const act = () => (href ? router.push(href) : onClick?.());
  const cb = useRef(act);
  useEffect(() => {
    cb.current = act;
  });

  useEffect(() => {
    const mb = app?.MainButton;
    if (!mb) return;
    const handler = () => cb.current();
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
      mb.hide();
    };
  }, [app]);

  useEffect(() => {
    const mb = app?.MainButton;
    if (!mb) return;
    mb.setParams({
      text: label,
      color: "#0B0B0B",
      text_color: "#FFFFFF",
      is_active: !disabled,
      is_visible: true,
    });
    if (loading) mb.showProgress(false);
    else mb.hideProgress();
  }, [app, label, disabled, loading]);

  if (app) return null;
  return (
    // --main-action-bottom: lifted above the app tab bar (set by the (app) layout), 0 elsewhere.
    <div className="sticky bottom-[var(--main-action-bottom,0px)] z-20 -mx-3 mt-auto bg-background/95 px-3 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur">
      {href ? (
        <Link href={href} className={bigButtonClass}>
          {label}
        </Link>
      ) : (
        <BigButton type="button" onClick={onClick} disabled={disabled || loading} aria-busy={loading}>
          {label}
        </BigButton>
      )}
    </div>
  );
}

/** "Back": Telegram's native BackButton, or a text link in the page header on the web. */
export function BackAction({
  label,
  onClick,
  className,
}: {
  label: string;
  onClick: () => void;
  className?: string;
}) {
  const app = useTelegramChrome();
  const cb = useRef(onClick);
  useEffect(() => {
    cb.current = onClick;
  });

  useEffect(() => {
    const bb = app?.BackButton;
    if (!bb) return;
    const handler = () => cb.current();
    bb.onClick(handler);
    bb.show();
    return () => {
      bb.offClick(handler);
      bb.hide();
    };
  }, [app]);

  if (app) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? "min-h-11 self-start px-1 text-[15px] font-medium text-blue"}
    >
      {label}
    </button>
  );
}

/** Paint Telegram's header/background in our page colour and open full height. */
export function TelegramInit() {
  const app = useTelegramChrome();
  useEffect(() => {
    if (!app) return;
    app.ready();
    app.expand();
    app.setHeaderColor?.("#EDEDED");
    app.setBackgroundColor?.("#EDEDED");
  }, [app]);
  return null;
}

/** BackAction for server pages: goes to a fixed place. */
export function BackTo({ label, href, className }: { label: string; href: string; className?: string }) {
  const router = useRouter();
  return <BackAction label={label} onClick={() => router.push(href)} className={className} />;
}
