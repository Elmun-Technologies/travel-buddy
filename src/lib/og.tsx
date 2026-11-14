import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { APP_NAME } from "./config";
import { photoName } from "./photos";

// Share images (OG 1200×630, story 1080×1920) in the App-CreateTrip-Share card style.
// Assets are pre-built in public/og (WOFF fonts with Latin + Cyrillic, JPEG photos): the image
// renderer can't read WOFF2/WebP and we never fetch anything from the internet at runtime.
const dir = path.join(process.cwd(), "public", "og");
const file = (p: string) => readFile(path.join(dir, p));

let fonts: Promise<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    file("fonts/inter-tight-latin-400-normal.woff"),
    file("fonts/inter-tight-cyrillic-400-normal.woff"),
    file("fonts/inter-latin-400-normal.woff"),
    file("fonts/inter-latin-ext-400-normal.woff"),
    file("fonts/inter-cyrillic-400-normal.woff"),
    file("fonts/inter-latin-600-normal.woff"),
    file("fonts/inter-cyrillic-600-normal.woff"),
  ]).then(([tl, tc, l, le, c, l6, c6]) => [
    { name: "Inter Tight", data: tl, weight: 400 as const },
    { name: "Inter Tight", data: tc, weight: 400 as const },
    { name: "Inter", data: l, weight: 400 as const },
    { name: "Inter", data: le, weight: 400 as const },
    { name: "Inter", data: c, weight: 400 as const },
    { name: "Inter", data: l6, weight: 600 as const },
    { name: "Inter", data: c6, weight: 600 as const },
  ]);
  return fonts;
}

export type ShareCard = {
  title: string;
  meta: string; // "20–27 noyabr · $300–600 · 1/8 joy band"
  cta: string; // "Men ham boraman"
  country: string;
  city: string | null;
};

export async function shareImage(card: ShareCard, kind: "og" | "story") {
  const [f, photo] = await Promise.all([
    loadFonts(),
    file(`photos/${photoName(card.country, card.city)}.jpg`),
  ]);
  const src = `data:image/jpeg;base64,${photo.toString("base64")}`;
  const story = kind === "story";
  const W = story ? 1080 : 1200;
  const H = story ? 1920 : 630;
  const s = story ? 1.6 : 1; // type scale

  return new ImageResponse(
    <div
      style={{
        width: W,
        height: H,
        display: "flex",
        flexDirection: story ? "column" : "row",
        background: "#EDEDED",
        padding: story ? 48 : 32,
        gap: story ? 32 : 24,
        fontFamily: "Inter",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered to PNG, not HTML */}
      <img
        src={src}
        alt=""
        width={story ? W - 96 : 620}
        height={story ? 1150 : H - 64}
        style={{ objectFit: "cover", borderRadius: 36 }}
      />
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fff",
          borderRadius: 36,
          padding: 40 * s,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 * s }}>
          <div
            style={{
              fontFamily: "Inter Tight",
              fontSize: 64 * s,
              letterSpacing: -2 * s,
              lineHeight: 1.02,
              color: "#0B0B0B",
            }}
          >
            {card.title}
          </div>
          <div style={{ fontSize: 28 * s, color: "#5F5F5F", lineHeight: 1.35 }}>{card.meta}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 26 * s, fontWeight: 600, color: "#0B0B0B" }}>{APP_NAME}</div>
          <div
            style={{
              background: "#0B0B0B",
              color: "#fff",
              borderRadius: 999,
              padding: `${16 * s}px ${30 * s}px`,
              fontSize: 28 * s,
              fontWeight: 600,
            }}
          >
            {card.cta}
          </div>
        </div>
      </div>
    </div>,
    { width: W, height: H, fonts: await f },
  );
}
