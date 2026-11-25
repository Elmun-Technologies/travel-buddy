import { cn } from "@/lib/utils";

const tones = ["bg-[#c9d4e3]", "bg-[#e6dccb]", "bg-[#d3e3d0]", "bg-[#ecd3dc]", "bg-[#d0e4e6]"];

/** Round picture, or the first letter on a soft colour when there is none. `version` busts the cache. */
export function Avatar({
  userId,
  name,
  version,
  className,
}: {
  userId: string;
  name: string;
  version?: string | null;
  className?: string;
}) {
  const base = "flex flex-none items-center justify-center overflow-hidden rounded-full font-semibold";
  if (version)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- already compressed WebP behind our own permission check
      <img
        src={`/api/media/avatar/${userId}?v=${version}`}
        alt=""
        loading="lazy"
        className={cn(base, "object-cover", className)}
      />
    );
  const tone = tones[[...userId].reduce((a, c) => a + c.charCodeAt(0), 0) % tones.length];
  return (
    <span className={cn(base, tone, className)} aria-hidden="true">
      {name.slice(0, 1)}
    </span>
  );
}
