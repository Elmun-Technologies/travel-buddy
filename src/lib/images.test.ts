import sharp from "sharp";
import { afterAll, describe, expect, it } from "vitest";
import { AVATAR, ImageError, PHOTO, processImage } from "./images";
import { deleteFile, getFile, newKey, putFile } from "./storage";

const noise = (w: number, h: number) =>
  sharp({
    create: {
      width: w,
      height: h,
      channels: 3,
      background: "#808080",
      noise: { type: "gaussian", mean: 128, sigma: 60 },
    },
  })
    .jpeg({ quality: 95 })
    .withExif({ IFD0: { Copyright: "secret-owner" } })
    .toBuffer();

describe("image pipeline", () => {
  it("makes a square avatar ≤ 1080 px and ≤ 300 KB WebP without metadata", async () => {
    const out = await processImage(await noise(3000, 2000), AVATAR, true);
    const meta = await sharp(out).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(meta.height);
    expect(meta.width!).toBeLessThanOrEqual(1080);
    expect(out.length).toBeLessThanOrEqual(300 * 1024);
    expect(meta.exif).toBeUndefined();
    expect(out.toString("latin1")).not.toContain("secret-owner");
  }, 30_000);

  it("keeps the shape of a photo, never enlarges it", async () => {
    const out = await processImage(await noise(800, 400), PHOTO);
    const meta = await sharp(out).metadata();
    expect([meta.width, meta.height]).toEqual([800, 400]);
  });

  it("rejects what is not a picture, a huge file and an unreadable one", async () => {
    await expect(processImage(Buffer.from("<svg onload=alert(1)/>"), AVATAR)).rejects.toMatchObject({
      code: "unreadable",
    });
    await expect(processImage(Buffer.alloc(9 * 1024 * 1024), AVATAR)).rejects.toBeInstanceOf(ImageError);
    const gif = await sharp({ create: { width: 10, height: 10, channels: 3, background: "#fff" } })
      .gif()
      .toBuffer();
    await expect(processImage(gif, AVATAR)).rejects.toMatchObject({ code: "not_image" });
  });
});

describe("local storage (development and tests)", () => {
  const key = newKey("photos");
  afterAll(() => deleteFile(key));
  it("stores, reads and deletes a file; odd keys are refused", async () => {
    await putFile(key, Buffer.from("hello"), "image/webp");
    expect((await getFile(key))?.body.toString()).toBe("hello");
    await deleteFile(key);
    expect(await getFile(key)).toBeNull();
    await expect(putFile("../../etc/passwd", Buffer.from("x"), "image/webp")).rejects.toThrow();
    expect(await getFile("photos/not-a-uuid.webp").catch(() => "threw")).toBe("threw");
  });
});
