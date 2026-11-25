"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { clayInput, Panel } from "@/components/clay";
import { useRouter } from "@/i18n/navigation";
import { haptic } from "@/lib/telegram-webapp";

type Photo = { id: string; userId: string; name: string };
type Story = { userId: string; name: string; body: string };

export function Album({
  tripId,
  me,
  isOwner,
  uploads,
  max,
  photos,
  stories,
  myStory,
  consent,
}: {
  tripId: string;
  me: string;
  isOwner: boolean;
  uploads: boolean;
  max: number;
  photos: Photo[];
  stories: Story[];
  myStory: string;
  consent: { finished: boolean; total: number; agreed: number; mine: boolean; link: string | null };
}) {
  const t = useTranslations("album");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [left, setLeft] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [story, setStory] = useState(myStory);
  const [saved, setSaved] = useState(false);
  const [agree, setAgree] = useState(consent.mine);

  async function upload(files: File[]) {
    setError(null);
    setLeft(files.length);
    for (const file of files) {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch(`/api/trips/${tripId}/photos`, { method: "POST", body }).catch(() => null);
      if (!res?.ok) {
        const e = res ? ((await res.json().catch(() => ({}))) as { error?: string }).error : "network";
        setError(
          e === "limit"
            ? t("limit", { n: max })
            : e === "too_big"
              ? t("errTooBig")
              : e === "uploads_off"
                ? t("errOff")
                : t("errUpload"),
        );
        haptic.error();
        break;
      }
      setLeft((n) => n - 1);
    }
    setLeft(0);
    router.refresh();
  }

  async function post(body: unknown) {
    return fetch(`/api/trips/${tripId}/memories`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
  }

  return (
    <>
      {uploads && (
        <>
          <input
            ref={input}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={t("add")}
            onChange={(e) => {
              const files = [...(e.target.files ?? [])].slice(0, 10);
              e.target.value = "";
              if (files.length) void upload(files);
            }}
          />
          <button
            type="button"
            disabled={left > 0}
            onClick={() => input.current?.click()}
            className="press flex min-h-[52px] items-center justify-center gap-2 rounded-button bg-ink px-4 font-semibold text-white disabled:opacity-60"
          >
            <ImagePlus className="size-5" aria-hidden="true" />
            {left > 0 ? t("adding", { n: left }) : t("add")}
          </button>
        </>
      )}
      {error && (
        <p role="alert" className="rounded-[18px] bg-danger-soft p-4 text-sm text-danger">
          {error}
        </p>
      )}

      {photos.length === 0 ? (
        <Panel className="text-[15px] text-muted-foreground">{t("empty")}</Panel>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {photos.map((p) => (
            <figure key={p.id} className="relative overflow-hidden rounded-[18px] bg-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- compressed WebP behind a membership check */}
              <img
                src={`/api/media/photo/${p.id}`}
                alt={t("photoAlt")}
                loading="lazy"
                className="aspect-square w-full object-cover"
              />
              <figcaption className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-muted-foreground">
                <span className="truncate">{t("by", { name: p.name })}</span>
                {(p.userId === me || isOwner) && (
                  <button
                    type="button"
                    className="min-h-11 text-danger"
                    onClick={async () => {
                      if ((await post({ op: "photo.delete", id: p.id }))?.ok) router.refresh();
                    }}
                  >
                    {t("delete")}
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {consent.finished && consent.total >= 2 && (
        <Panel tone="soft" className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("publicTitle")}</h2>
          <p className="text-sm">{t("publicHint")}</p>
          <label className="flex min-h-11 items-center gap-3 text-[15px] font-medium">
            <input
              type="checkbox"
              className="size-5"
              checked={agree}
              onChange={async (e) => {
                const on = e.target.checked;
                setAgree(on); // show the choice at once; undo if the server said no
                if ((await post({ op: "consent", on }))?.ok) router.refresh();
                else setAgree(!on);
              }}
            />
            {t("publicAgree")}
          </label>
          <p className="text-sm">{t("publicCount", { n: consent.agreed, m: consent.total })}</p>
          {consent.link ? (
            <a
              href={consent.link}
              className="min-h-11 text-[15px] font-semibold break-all text-blue underline"
            >
              {consent.link}
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">{t("publicWaiting")}</p>
          )}
        </Panel>
      )}

      <Panel className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("storiesTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("storyHint")}</p>
        <textarea
          value={story}
          onChange={(e) => {
            setStory(e.target.value);
            setSaved(false);
          }}
          maxLength={600}
          rows={3}
          aria-label={t("storiesTitle")}
          placeholder={t("storyPlaceholder")}
          className={`${clayInput} min-h-24 rounded-[18px] py-3`}
        />
        <button
          type="button"
          disabled={story.trim().length < 2}
          onClick={async () => {
            if ((await post({ op: "story", body: story }))?.ok) {
              haptic.success();
              setSaved(true);
              router.refresh();
            }
          }}
          className="press min-h-11 self-start rounded-full bg-ink px-6 text-[15px] font-medium text-white disabled:opacity-50"
        >
          {saved ? t("storySaved") : t("storySave")}
        </button>
        {stories.length === 0 && <p className="text-sm text-muted-foreground">{t("noStories")}</p>}
        {stories.map((s) => (
          <div key={s.userId} className="border-t border-line pt-3">
            <div className="text-sm font-semibold">{s.name}</div>
            <p className="text-[15px] whitespace-pre-wrap">{s.body}</p>
          </div>
        ))}
      </Panel>
    </>
  );
}
