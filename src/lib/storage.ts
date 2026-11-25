import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// File storage. Production: an S3-compatible bucket (SeaweedFS) that is never public: every file is
// served through our own routes after a permission check. Development and tests, with no S3
// settings: a folder on disk. Production without S3 settings: uploads are switched off (the UI hides them).

const bucket = () => process.env.S3_BUCKET_FILES || "tb-files";
const configured = () =>
  !!(process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY);
const localDir = () => resolve(process.env.LOCAL_UPLOAD_DIR || ".local/uploads");
const localAllowed = () => process.env.APP_ENV !== "production";

let client: S3Client | null = null;
function s3() {
  client ??= new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY!, secretAccessKey: process.env.S3_SECRET_KEY! },
  });
  return client;
}

/** Can people upload files right now? */
export const storageEnabled = () => configured() || localAllowed();

/** Object key under a folder: "avatars/<uuid>.webp". Random, so a URL cannot be guessed. */
export const newKey = (folder: "avatars" | "photos" | "chat" | "id" | "agency", ext = "webp") =>
  `${folder}/${randomUUID()}.${ext}`;

const safe = (key: string) => {
  if (!/^[a-z]+\/[0-9a-f-]{36}\.[a-z]{3,4}$/.test(key)) throw new Error("bad storage key");
  return key;
};

export async function putFile(key: string, body: Buffer, contentType: string) {
  safe(key);
  if (configured()) {
    await s3().send(
      new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
    );
    return;
  }
  if (!localAllowed()) throw new Error("storage is not configured");
  const path = join(localDir(), key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

export async function getFile(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  safe(key);
  try {
    if (configured()) {
      const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      const body = Buffer.from(await r.Body!.transformToByteArray());
      return { body, contentType: r.ContentType || "application/octet-stream" };
    }
    if (!localAllowed()) return null;
    return { body: await readFile(join(localDir(), key)), contentType: "image/webp" };
  } catch {
    return null;
  }
}

export async function deleteFile(key: string | null | undefined) {
  if (!key) return;
  try {
    safe(key);
    if (configured()) await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
    else if (localAllowed()) await rm(join(localDir(), key), { force: true });
  } catch {
    // a file that is already gone is fine
  }
}
