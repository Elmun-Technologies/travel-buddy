import "server-only";
import sharp from "sharp";

// Small server, many neighbours: one image at a time, a tiny cache, and a cap on decoded pixels.
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 0 });

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(["jpeg", "png", "webp"]);

export type ImageProfile = { maxSide: number; maxBytes: number };
/** Profile picture: up to 1080 px and 300 KB (CLAUDE.md §2.1). */
export const AVATAR: ImageProfile = { maxSide: 1080, maxBytes: 300 * 1024 };
/** Photos in chat and in albums: up to 1600 px and 500 KB. */
export const PHOTO: ImageProfile = { maxSide: 1600, maxBytes: 500 * 1024 };
/** Documents for manual checks (ID, agency papers): readable, so larger. */
export const DOCUMENT: ImageProfile = { maxSide: 2000, maxBytes: 900 * 1024 };

export class ImageError extends Error {
  constructor(public code: "not_image" | "too_big" | "unreadable") {
    super(code);
  }
}

/**
 * Any JPEG/PNG/WebP in, an upright WebP out: metadata (GPS, camera) removed, scaled down,
 * quality lowered step by step until it fits the size budget.
 */
export async function processImage(input: Buffer, p: ImageProfile, square = false): Promise<Buffer> {
  if (input.length > MAX_UPLOAD_BYTES) throw new ImageError("too_big");
  try {
    const meta = await sharp(input, { limitInputPixels: 40_000_000 }).metadata();
    if (!meta.format || !ACCEPTED.has(meta.format)) throw new ImageError("not_image");
    for (const quality of [82, 70, 58, 46, 34]) {
      const out = await sharp(input, { limitInputPixels: 40_000_000 })
        .rotate() // honour the phone's orientation, then metadata is dropped on output
        .resize({
          width: p.maxSide,
          height: p.maxSide,
          fit: square ? "cover" : "inside",
          withoutEnlargement: !square,
        })
        .webp({ quality })
        .toBuffer();
      if (out.length <= p.maxBytes) return out;
    }
    // still too big at the lowest quality: shrink the picture itself
    return await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: Math.round(p.maxSide / 2), height: Math.round(p.maxSide / 2), fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer();
  } catch (e) {
    if (e instanceof ImageError) throw e;
    throw new ImageError("unreadable");
  }
}
