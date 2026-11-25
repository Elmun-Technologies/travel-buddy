// Integration test against a real Postgres (runs when DATABASE_URL is set).
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { users } from "@/db/schema";
import { getDb } from "@/lib/db";
import { hasTelegram, linkProvider, loginWithGoogle, loginWithTelegram } from "./service";

const run = !!process.env.DATABASE_URL;
const base = Math.floor(Math.random() * 1e9) + 1.1e10;
const created: string[] = [];

describe.runIf(run)("Google sign-in and linking (db)", () => {
  afterAll(async () => {
    await getDb().delete(users).where(inArray(users.id, created));
  });

  it("same Google id → same account; email kept; Telegram can be linked once", async () => {
    const sub = `g${base}`;
    const a = await loginWithGoogle(sub, "ali@example.uz", "uz");
    const b = await loginWithGoogle(sub, "other@example.uz", "ru");
    if (!a.ok || !b.ok) throw new Error("login");
    created.push(a.userId);
    expect(a.userId).toBe(b.userId);
    expect([a.isNew, b.isNew]).toEqual([true, false]);
    const [u] = await getDb().select().from(users).where(eq(users.id, a.userId));
    expect(u.email).toBe("ali@example.uz");

    expect(await hasTelegram(a.userId)).toBe(false);
    expect(await linkProvider(a.userId, "telegram", String(base))).toBe("ok");
    expect(await hasTelegram(a.userId)).toBe(true);
    // now the same Telegram signs in to the same account
    const t = await loginWithTelegram({ id: base }, "uz");
    expect(t.ok && t.userId === a.userId && !t.isNew).toBe(true);

    // someone else cannot take that Telegram, and one account holds one Telegram
    const other = await loginWithGoogle(`g${base + 1}`, null, "uz");
    if (!other.ok) throw new Error("login");
    created.push(other.userId);
    expect(await linkProvider(other.userId, "telegram", String(base))).toBe("taken");
    expect(await linkProvider(a.userId, "telegram", String(base + 5))).toBe("taken");
    expect(await linkProvider(a.userId, "telegram", String(base))).toBe("already");
  });
});
