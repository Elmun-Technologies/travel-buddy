import { Display, Panel } from "@/components/clay";
import { Link } from "@/i18n/navigation";

/** One sentence, one action (plan v2 §4.5): never a blank screen. */
export function EmptyState({
  title,
  text,
  action,
  href,
}: {
  title: string;
  text: string;
  action: string;
  href: string;
}) {
  return (
    <Panel className="flex flex-col gap-4">
      <Display className="text-[32px]">{title}</Display>
      <p className="text-[15px] leading-relaxed text-muted-foreground">{text}</p>
      <Link
        href={href}
        className="press flex min-h-[52px] items-center justify-center rounded-button bg-ink px-4 font-semibold text-white"
      >
        {action}
      </Link>
    </Panel>
  );
}
