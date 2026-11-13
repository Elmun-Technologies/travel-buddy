import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { sessions, users } from "@/db/schema";
import { getDb } from "./db";

const COOKIE = "tb_session";
const TTL_DAYS = 30;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const secure = () => (process.env.APP_URL ?? "").startsWith("https://");

export type SessionUser = {
  id: string;
  role: "traveler" | "agency_member" | "admin";
  phoneVerified: boolean;
};

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_DAYS * 86_400_000);
  await getDb()
    .insert(sessions)
    .values({
      userId,
      tokenHash: hash(token),
      expiresAt,
      ip: meta.ip,
      userAgent: meta.userAgent?.slice(0, 300),
    });
  // SameSite=None + Partitioned so the session also works inside web.telegram.org's Mini App iframe.
  // Server Actions are still CSRF-protected by Next's Origin check.
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: secure(),
    sameSite: secure() ? "none" : "lax",
    partitioned: secure(),
    path: "/",
    expires: expiresAt,
  });
}

/** Current user or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Request-time only (expiry check uses the clock; keeps session reads out of runtime prefetch).
  await connection();
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({ id: users.id, role: users.role, phoneVerified: users.phoneVerified })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hash(token)),
        gt(sessions.expiresAt, new Date()),
        eq(users.status, "active"),
        isNull(users.deletedAt),
      ),
    );
  return row ?? null;
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token)
    await getDb()
      .delete(sessions)
      .where(eq(sessions.tokenHash, hash(token)));
  jar.delete({
    name: COOKIE,
    path: "/",
    secure: secure(),
    sameSite: secure() ? "none" : "lax",
    partitioned: secure(),
  });
}
